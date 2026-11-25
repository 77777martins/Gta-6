import "server-only";
import type { Order } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toSaoPauloIso } from "@/lib/datetime";
import { env, pixProvider } from "@/lib/env";
import { logger } from "@/lib/logger";
import { isValidCpf } from "@/lib/validation/cpf";
import type { CardPaymentInput } from "@/lib/validation/card-payment";
import {
  createPayment,
  credentialFingerprint,
  getPayment,
  type CreatePaymentBody,
  type MercadoPagoPayment,
} from "@/server/mercadopago/client";
import { OrderNotPayableError, PaymentInputError } from "./errors";
import { normalizePixoupay, recordNormalizedPayment, recordPayment } from "./service";
import { createPixoupayCharge, getPixoupayTransaction } from "@/server/pixoupay/client";
import { isPayable, toCents } from "./status";

/** Validade do QR Code PIX. */
const PIX_TTL_MS = 30 * 60 * 1000;
/** Margem para não reaproveitar um QR Code prestes a expirar. */
const PIX_REUSE_MARGIN_MS = 2 * 60 * 1000;

const IN_FLIGHT_CARD_STATUSES = ["in_process", "authorized"];

async function loadPayableOrder(orderId: string): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new OrderNotPayableError("not_found");
  if (!isPayable(order.status)) throw new OrderNotPayableError("not_pending");
  return order;
}

function splitName(fullName: string) {
  const [first = "", ...rest] = fullName.trim().split(/\s+/);
  return { first_name: first, last_name: rest.join(" ") };
}

/** Informações do item/comprador: ajudam a análise antifraude do Mercado Pago. */
function additionalInfo(order: Order): CreatePaymentBody["additional_info"] {
  return {
    items: [
      {
        id: order.productSku,
        title: order.productName,
        quantity: 1,
        unit_price: order.unitPriceCents / 100,
        category_id: "games",
      },
    ],
    payer: {
      ...splitName(order.customerName),
      ...(order.customerPhone
        ? { phone: { area_code: order.customerPhone.slice(0, 2), number: order.customerPhone.slice(2) } }
        : {}),
    },
  } as CreatePaymentBody["additional_info"];
}

// ---------------------------------------------------------------- PIX

/** `expiresAt` pode faltar: o Pixoupay não informa a validade do QR Code. */
export type PixData = { qrCode: string; qrCodeBase64: string; ticketUrl: string | null; expiresAt: string | null };

/** Janela em que um QR Code do Pixoupay ainda pendente é reaproveitado. */
const PIXOUPAY_REUSE_MS = 20 * 60 * 1000;

function extractPix(payment: MercadoPagoPayment): PixData | null {
  const data = payment.point_of_interaction?.transaction_data;
  const qrCode = data?.qr_code ?? "";
  const qrCodeBase64 = data?.qr_code_base64 ?? "";
  // Só aceita base64 puro: o valor vira o src de uma imagem no navegador.
  if (!qrCode || !/^[A-Za-z0-9+/=]+$/.test(qrCodeBase64)) return null;
  const ticketUrl = data?.ticket_url && data.ticket_url.startsWith("https://") ? data.ticket_url : null;
  return {
    qrCode,
    qrCodeBase64,
    ticketUrl,
    expiresAt: payment.date_of_expiration ?? new Date(Date.now() + PIX_TTL_MS).toISOString(),
  };
}

/**
 * Gera (ou reaproveita) a cobrança PIX do pedido. Um QR Code ainda válido é
 * devolvido de novo em vez de criar outra cobrança, evitando duplicidade.
 */
export async function createPixPayment(orderId: string): Promise<PixData> {
  const order = await loadPayableOrder(orderId);
  if (pixProvider() === "pixoupay") return createPixoupayPix(order);

  const pixPayments = await prisma.payment.findMany({
    where: { orderId, provider: "mercadopago", paymentMethodId: "pix" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });

  const latestPending = pixPayments.find((p) => p.status === "pending");
  if (latestPending) {
    const current = await getPayment(latestPending.id);
    await recordPayment(current);
    const expiresAt = current.date_of_expiration ? new Date(current.date_of_expiration).getTime() : 0;
    const pix = extractPix(current);
    if (current.status === "pending" && pix && expiresAt - Date.now() > PIX_REUSE_MARGIN_MS) return pix;
  }

  const payment = await createPayment(
    {
      transaction_amount: order.totalCents / 100,
      description: order.productName,
      payment_method_id: "pix",
      external_reference: order.id,
      date_of_expiration: toSaoPauloIso(new Date(Date.now() + PIX_TTL_MS)),
      payer: {
        email: order.customerEmail,
        ...splitName(order.customerName),
        identification: { type: "CPF", number: order.customerCpf },
      },
      additional_info: additionalInfo(order),
      metadata: { order_id: order.id },
    },
    // Nova cobrança só quando a anterior expirou: o contador muda a chave.
    `pix-${order.id}-${credentialFingerprint()}-${pixPayments.length}`,
  );

  await recordPayment(payment);
  const pix = extractPix(payment);
  if (!pix) throw new PaymentInputError("O Mercado Pago não retornou o QR Code do PIX.");
  logger.info("pix.created", { orderId: order.id, paymentId: payment.id });
  return pix;
}

// ---------------------------------------------------------------- Cartão

export type CardResult = { status: string; statusDetail: string | null; orderStatus: string | null };

export async function createCardPayment(
  orderId: string,
  input: CardPaymentInput,
  attemptKey: string,
): Promise<CardResult> {
  const order = await loadPayableOrder(orderId);

  // O valor exibido no navegador precisa bater com o pedido: diferença indica adulteração.
  if (toCents(input.transaction_amount) !== order.totalCents) {
    logger.warn("card.amount_mismatch", { orderId, received: input.transaction_amount });
    throw new PaymentInputError("Valor do pagamento não confere com o pedido.");
  }
  if (input.installments > env().MERCADOPAGO_MAX_INSTALLMENTS) {
    throw new PaymentInputError("Número de parcelas não permitido.");
  }

  // Evita uma segunda cobrança enquanto outra está em análise.
  const inFlight = await prisma.payment.count({
    where: { orderId, paymentTypeId: "credit_card", status: { in: IN_FLIGHT_CARD_STATUSES } },
  });
  if (inFlight > 0) throw new OrderNotPayableError("in_process");

  // Documento do titular do cartão (pode ser outra pessoa); se ausente/inválido, usa o do pedido.
  const holderDoc = input.payer?.identification;
  const identification =
    holderDoc && (holderDoc.type === "CNPJ" || isValidCpf(holderDoc.number))
      ? holderDoc
      : { type: "CPF" as const, number: order.customerCpf };

  const payment = await createPayment(
    {
      transaction_amount: order.totalCents / 100,
      token: input.token,
      description: order.productName,
      installments: input.installments,
      payment_method_id: input.payment_method_id,
      ...(input.issuer_id ? { issuer_id: input.issuer_id } : {}),
      external_reference: order.id,
      statement_descriptor: env().MERCADOPAGO_STATEMENT_DESCRIPTOR,
      payer: { email: order.customerEmail, ...splitName(order.customerName), identification },
      additional_info: additionalInfo(order),
      metadata: { order_id: order.id },
    },
    `card-${order.id}-${attemptKey}`,
  );

  const orderStatus = await recordPayment(payment);
  logger.info("card.processed", { orderId, paymentId: payment.id, status: payment.status, detail: payment.status_detail });
  return { status: payment.status, statusDetail: payment.status_detail ?? null, orderStatus };
}

// ---------------------------------------------------------------- PIX (Pixoupay)

/**
 * PIX pelo Pixoupay. O `external_id` é único por vendedor na Pixoupay, então cada
 * nova cobrança do mesmo pedido recebe um sufixo (pedido_1, pedido_2...).
 * Um QR Code recente e ainda pendente é reaproveitado (sem cobrança duplicada).
 */
async function createPixoupayPix(order: Order): Promise<PixData> {
  const previous = await prisma.payment.findMany({
    where: { orderId: order.id, provider: "pixoupay" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true, pixCode: true, pixQrBase64: true },
  });

  const recent = previous[0];
  if (recent?.status === "pending" && recent.pixCode && recent.pixQrBase64 && Date.now() - recent.createdAt.getTime() < PIXOUPAY_REUSE_MS) {
    // Confirma na API que ainda está pendente antes de reexibir.
    const current = await getPixoupayTransaction(recent.id);
    await recordNormalizedPayment(normalizePixoupay(current, order.id));
    if (current.status === "pending") {
      return { qrCode: recent.pixCode, qrCodeBase64: recent.pixQrBase64, ticketUrl: null, expiresAt: null };
    }
  }

  const { APP_URL, PIXOUPAY_WEBHOOK_TOKEN } = env();
  const charge = await createPixoupayCharge({
    externalId: `${order.id}_${previous.length + 1}`,
    amountCents: order.totalCents,
    buyer: {
      name: order.customerName,
      email: order.customerEmail,
      document: order.customerCpf,
      phone: order.customerPhone,
    },
    productName: order.productName,
    ...(PIXOUPAY_WEBHOOK_TOKEN
      ? { postbackUrl: `${APP_URL}/api/webhooks/pixoupay?token=${encodeURIComponent(PIXOUPAY_WEBHOOK_TOKEN)}` }
      : {}),
  });

  await recordNormalizedPayment(
    normalizePixoupay(charge, order.id, { code: charge.pix.code, qrBase64: charge.pix.qrcode_base64 }),
  );
  logger.info("pix.created", { orderId: order.id, provider: "pixoupay", paymentId: charge.id });
  return { qrCode: charge.pix.code, qrCodeBase64: charge.pix.qrcode_base64, ticketUrl: null, expiresAt: null };
}
