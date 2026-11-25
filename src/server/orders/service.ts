import "server-only";
import { Prisma, type Order, type OrderStatus } from "@prisma/client";
import { PLATFORMS, PRODUCT } from "@/config/product";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger, maskEmail } from "@/lib/logger";
import type { CheckoutData } from "@/lib/validation/checkout";
import {
  createPreference,
  credentialFingerprint,
  getPayment,
  type MercadoPagoPayment,
} from "@/server/mercadopago/client";
import {
  getPixoupayTransaction,
  normalizePixoupayStatus,
  type PixoupayStatus,
} from "@/server/pixoupay/client";
import { IdempotencyConflictError, SalesClosedError } from "./errors";
import { deriveOrderStatus, isPayable, toCents } from "./status";

/** Janela em que um pedido pendente idêntico é reaproveitado em vez de duplicado. */
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

/** `checkoutUrl` só existe no modo Checkout Pro (redirecionamento). */
export type CheckoutResult = { orderId: string; checkoutUrl?: string };

/**
 * Cria (ou reaproveita) um pedido e sua preferência no Mercado Pago.
 *
 * Camadas contra duplicidade:
 * 1. Idempotency-Key única por tentativa (duplo clique / retry de rede).
 * 2. Pedido PENDING idêntico (e-mail + plataforma) nos últimos 15 min é reaproveitado
 *    (inclusive se a criação da preferência falhou antes — evita pedidos órfãos).
 * 3. X-Idempotency-Key derivada do pedido na chamada ao Mercado Pago.
 */
export async function createCheckout(
  data: CheckoutData,
  idempotencyKey: string,
  options: { transparent?: boolean } = {},
): Promise<CheckoutResult> {
  const finish = (order: Order) => (options.transparent ? ensurePayable(order) : ensurePreference(order));
  if (!env().SALES_ENABLED) throw new SalesClosedError();

  const byKey = await prisma.order.findUnique({ where: { idempotencyKey } });
  if (byKey) {
    if (byKey.customerEmail !== data.email || byKey.platform !== data.platform) throw new IdempotencyConflictError();
    return finish(byKey);
  }

  const recent = await prisma.order.findFirst({
    where: {
      customerEmail: data.email,
      platform: data.platform,
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    logger.info("checkout.reused_pending_order", { orderId: recent.id });
    return finish(recent);
  }

  let order: Order;
  try {
    order = await prisma.order.create({
      data: {
        idempotencyKey,
        customerName: data.name,
        customerEmail: data.email,
        customerCpf: data.cpf,
        customerPhone: data.phone ?? null,
        platform: data.platform,
        productSku: PRODUCT.sku,
        productName: `${PRODUCT.name} — ${PLATFORMS[data.platform].label}`,
        unitPriceCents: PRODUCT.priceCents,
        quantity: 1,
        totalCents: PRODUCT.priceCents,
        currency: PRODUCT.currency,
      },
    });
  } catch (error) {
    // Corrida entre duas requisições com a mesma chave: devolve o pedido vencedor.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.order.findUniqueOrThrow({ where: { idempotencyKey } });
      return finish(existing);
    }
    throw error;
  }

  logger.info("checkout.order_created", { orderId: order.id, email: maskEmail(order.customerEmail) });
  return finish(order);
}

/** Modo transparente: o pedido só precisa estar aguardando pagamento. */
function ensurePayable(order: Order): CheckoutResult {
  if (!isPayable(order.status)) throw new IdempotencyConflictError();
  return { orderId: order.id };
}

async function ensurePreference(order: Order): Promise<CheckoutResult> {
  if (order.status !== "PENDING") {
    // Pedido já pago/finalizado: nunca gera novo link de pagamento para ele.
    throw new IdempotencyConflictError();
  }
  // Só reaproveita o link se foi criado com a MESMA credencial (teste x produção).
  if (order.mpPreferenceId && order.mpCheckoutUrl && order.mpCredentialFp === credentialFingerprint()) {
    return { orderId: order.id, checkoutUrl: order.mpCheckoutUrl };
  }

  const { preferenceId, checkoutUrl, credentialFp } = await createPreference({
    orderId: order.id,
    item: { id: order.productSku, title: order.productName, unitPriceCents: order.unitPriceCents, currency: order.currency },
    payer: {
      name: order.customerName,
      email: order.customerEmail,
      cpf: order.customerCpf,
      phone: order.customerPhone,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { mpPreferenceId: preferenceId, mpCheckoutUrl: checkoutUrl, mpCredentialFp: credentialFp },
  });
  return { orderId: order.id, checkoutUrl };
}

/**
 * Sincroniza um pagamento consultando a API do Mercado Pago (nunca confia no
 * payload do webhook nem em query strings). Idempotente e seguro para chamadas
 * concorrentes: trava a linha do pedido durante o recálculo do status.
 *
 * Retorna o status atual do pedido, ou null se o pagamento não for desta loja.
 */
export async function syncPayment(paymentId: string): Promise<OrderStatus | null> {
  return recordPayment(await getPayment(paymentId));
}

/** Pagamento já convertido para o formato interno, independente do provedor. */
export type NormalizedPayment = {
  provider: "mercadopago" | "pixoupay";
  id: string;
  orderId: string;
  status: string;
  statusDetail: string | null;
  paymentMethodId: string | null;
  paymentTypeId: string | null;
  amountCents: number;
  currency: string;
  dateApproved: Date | null;
  dateLastUpdated: Date | null;
  /** Só na criação de PIX do Pixoupay (a consulta não devolve o QR Code). */
  pix?: { code: string; qrBase64: string };
};

/** Registra um pagamento do Mercado Pago (vindo da API, nunca do navegador). */
export async function recordPayment(payment: MercadoPagoPayment): Promise<OrderStatus | null> {
  return recordNormalizedPayment({
    provider: "mercadopago",
    id: payment.id,
    orderId: payment.external_reference ?? "",
    status: payment.status,
    statusDetail: payment.status_detail ?? null,
    paymentMethodId: payment.payment_method_id ?? null,
    paymentTypeId: payment.payment_type_id ?? null,
    amountCents: toCents(payment.transaction_amount),
    currency: payment.currency_id,
    dateApproved: payment.date_approved ? new Date(payment.date_approved) : null,
    dateLastUpdated: payment.date_last_updated ? new Date(payment.date_last_updated) : null,
  });
}

/**
 * Grava o estado de um pagamento e recalcula o status do pedido. Usado pelos
 * webhooks, pela página de retorno e pela criação de PIX/cartão.
 * Seguro para chamadas concorrentes: trava a linha do pedido durante o recálculo.
 */
export async function recordNormalizedPayment(payment: NormalizedPayment): Promise<OrderStatus | null> {
  const { id: paymentId, orderId } = payment;

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    logger.warn("payment.sync.unknown_reference", { paymentId, provider: payment.provider });
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
    if (locked.length === 0) {
      logger.warn("payment.sync.order_not_found", { paymentId, orderId });
      return null;
    }
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

    const amountMatches = payment.amountCents === order.totalCents && payment.currency === order.currency;
    if (!amountMatches) {
      logger.error("payment.sync.amount_mismatch", {
        paymentId,
        orderId,
        expectedCents: order.totalCents,
        receivedCents: payment.amountCents,
        currency: payment.currency,
      });
    }

    const existing = await tx.payment.findUnique({ where: { id: paymentId } });
    if (existing && existing.orderId !== orderId) {
      logger.error("payment.sync.order_mismatch", { paymentId, orderId, storedOrderId: existing.orderId });
      return null;
    }
    const isStale =
      existing?.mpDateLastUpdated && payment.dateLastUpdated && payment.dateLastUpdated < existing.mpDateLastUpdated;
    // Pixoupay não informa data de atualização: um "pago" nunca volta para "pendente".
    const wouldDowngrade = payment.provider === "pixoupay" && existing?.status === "approved" && payment.status !== "approved";

    if (!isStale && !wouldDowngrade) {
      const fields = {
        status: payment.status,
        statusDetail: payment.statusDetail,
        paymentMethodId: payment.paymentMethodId,
        paymentTypeId: payment.paymentTypeId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        amountMatches,
        mpDateApproved: payment.dateApproved ?? existing?.mpDateApproved ?? null,
        mpDateLastUpdated: payment.dateLastUpdated,
      };
      await tx.payment.upsert({
        where: { id: paymentId },
        create: {
          id: paymentId,
          provider: payment.provider,
          orderId,
          ...fields,
          pixCode: payment.pix?.code ?? null,
          pixQrBase64: payment.pix?.qrBase64 ?? null,
        },
        update: fields,
      });
    }

    const payments = await tx.payment.findMany({ where: { orderId }, select: { status: true, amountMatches: true } });
    const status = deriveOrderStatus(payments);

    if (status !== order.status) {
      await tx.order.update({
        where: { id: orderId },
        data: { status, paidAt: status === "APPROVED" ? (order.paidAt ?? new Date()) : order.paidAt },
      });
      logger.info("order.status_changed", { orderId, from: order.status, to: status, paymentId });
    }
    return status;
  });
}

/**
 * Sincroniza um pagamento do Pixoupay já registrado (o webhook do Pixoupay não
 * tem assinatura: por isso o status SEMPRE é confirmado na API antes de gravar).
 */
export async function syncPixoupayPayment(paymentId: string): Promise<OrderStatus | null> {
  const stored = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { orderId: true, provider: true },
  });
  if (!stored || stored.provider !== "pixoupay") {
    logger.warn("pixoupay.sync.unknown_payment", { paymentId });
    return null;
  }
  const tx = await getPixoupayTransaction(paymentId);
  return recordNormalizedPayment(normalizePixoupay(tx, stored.orderId));
}

export function normalizePixoupay(
  tx: { id: string; status: PixoupayStatus; total_amount: number },
  orderId: string,
  pix?: { code: string; qrBase64: string },
): NormalizedPayment {
  const status = normalizePixoupayStatus(tx.status);
  return {
    provider: "pixoupay",
    id: tx.id,
    orderId,
    status,
    statusDetail: tx.status,
    paymentMethodId: "pix",
    paymentTypeId: "bank_transfer",
    amountCents: tx.total_amount,
    currency: "BRL",
    dateApproved: status === "approved" ? new Date() : null,
    dateLastUpdated: null,
    ...(pix ? { pix } : {}),
  };
}

/** Re-sincroniza pedidos pendentes cujo pagamento conhecido não é consultado há algum tempo. */
export async function refreshPendingOrder(orderId: string, minAgeMs = 30_000): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { orderId, order: { status: "PENDING" }, updatedAt: { lt: new Date(Date.now() - minAgeMs) } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, provider: true },
  });
  if (!payment) return;
  if (payment.provider === "pixoupay") await syncPixoupayPayment(payment.id);
  else await syncPayment(payment.id);
}

export type PublicOrderView = {
  id: string;
  status: OrderStatus;
  productName: string;
  totalCents: number;
  emailMasked: string;
  createdAt: Date;
  paidAt: Date | null;
  /** "pix" | "credit_card" | ... do pagamento mais recente, se houver. */
  paymentType: string | null;
};

/** Visão pública mínima do pedido (sem CPF, telefone, nome ou e-mail completo). */
export async function getPublicOrder(orderId: string): Promise<PublicOrderView | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      productName: true,
      totalCents: true,
      customerEmail: true,
      createdAt: true,
      paidAt: true,
      payments: { orderBy: { updatedAt: "desc" }, take: 1, select: { paymentTypeId: true, paymentMethodId: true } },
    },
  });
  if (!order) return null;
  const { customerEmail, payments, ...rest } = order;
  const last = payments[0];
  const paymentType = last ? (last.paymentMethodId === "pix" ? "pix" : last.paymentTypeId) : null;
  return { ...rest, emailMasked: maskEmail(customerEmail), paymentType };
}
