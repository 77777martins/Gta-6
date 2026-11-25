import "server-only";
import { Prisma, type Order, type OrderStatus } from "@prisma/client";
import { PLATFORMS, PRODUCT } from "@/config/product";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { logger, maskEmail } from "@/lib/logger";
import type { CheckoutData } from "@/lib/validation/checkout";
import { createPreference, getPayment } from "@/server/mercadopago/client";
import { IdempotencyConflictError, SalesClosedError } from "./errors";
import { deriveOrderStatus, toCents } from "./status";

/** Janela em que um pedido pendente idêntico é reaproveitado em vez de duplicado. */
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

export type CheckoutResult = { orderId: string; checkoutUrl: string };

/**
 * Cria (ou reaproveita) um pedido e sua preferência no Mercado Pago.
 *
 * Camadas contra duplicidade:
 * 1. Idempotency-Key única por tentativa (duplo clique / retry de rede).
 * 2. Pedido PENDING idêntico (e-mail + plataforma) nos últimos 15 min é reaproveitado
 *    (inclusive se a criação da preferência falhou antes — evita pedidos órfãos).
 * 3. X-Idempotency-Key derivada do pedido na chamada ao Mercado Pago.
 */
export async function createCheckout(data: CheckoutData, idempotencyKey: string): Promise<CheckoutResult> {
  if (!env().SALES_ENABLED) throw new SalesClosedError();

  const byKey = await prisma.order.findUnique({ where: { idempotencyKey } });
  if (byKey) {
    if (byKey.customerEmail !== data.email || byKey.platform !== data.platform) throw new IdempotencyConflictError();
    return ensurePreference(byKey);
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
    return ensurePreference(recent);
  }

  let order: Order;
  try {
    order = await prisma.order.create({
      data: {
        idempotencyKey,
        customerName: data.name,
        customerEmail: data.email,
        customerCpf: data.cpf,
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
      return ensurePreference(existing);
    }
    throw error;
  }

  logger.info("checkout.order_created", { orderId: order.id, email: maskEmail(order.customerEmail) });
  return ensurePreference(order);
}

async function ensurePreference(order: Order): Promise<CheckoutResult> {
  if (order.status !== "PENDING") {
    // Pedido já pago/finalizado: nunca gera novo link de pagamento para ele.
    throw new IdempotencyConflictError();
  }
  if (order.mpPreferenceId && order.mpCheckoutUrl) {
    return { orderId: order.id, checkoutUrl: order.mpCheckoutUrl };
  }

  const { preferenceId, checkoutUrl } = await createPreference({
    orderId: order.id,
    item: { id: order.productSku, title: order.productName, unitPriceCents: order.unitPriceCents, currency: order.currency },
    payer: { name: order.customerName, email: order.customerEmail, cpf: order.customerCpf },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { mpPreferenceId: preferenceId, mpCheckoutUrl: checkoutUrl },
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
  const payment = await getPayment(paymentId);
  const orderId = payment.external_reference ?? "";

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    logger.warn("payment.sync.unknown_reference", { paymentId });
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

    const amountCents = toCents(payment.transaction_amount);
    const amountMatches = amountCents === order.totalCents && payment.currency_id === order.currency;
    if (!amountMatches) {
      logger.error("payment.sync.amount_mismatch", {
        paymentId,
        orderId,
        expectedCents: order.totalCents,
        receivedCents: amountCents,
        currency: payment.currency_id,
      });
    }

    const lastUpdated = payment.date_last_updated ? new Date(payment.date_last_updated) : null;
    const existing = await tx.payment.findUnique({ where: { id: payment.id } });
    const isStale = existing?.mpDateLastUpdated && lastUpdated && lastUpdated < existing.mpDateLastUpdated;

    if (!isStale) {
      const fields = {
        status: payment.status,
        statusDetail: payment.status_detail ?? null,
        paymentMethodId: payment.payment_method_id ?? null,
        paymentTypeId: payment.payment_type_id ?? null,
        amountCents,
        currency: payment.currency_id,
        amountMatches,
        mpDateApproved: payment.date_approved ? new Date(payment.date_approved) : null,
        mpDateLastUpdated: lastUpdated,
      };
      await tx.payment.upsert({
        where: { id: payment.id },
        create: { id: payment.id, orderId, ...fields },
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

/** Re-sincroniza pedidos pendentes cujo pagamento conhecido não é consultado há algum tempo. */
export async function refreshPendingOrder(orderId: string, minAgeMs = 30_000): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { orderId, order: { status: "PENDING" }, updatedAt: { lt: new Date(Date.now() - minAgeMs) } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (payment) await syncPayment(payment.id);
}

export type PublicOrderView = {
  id: string;
  status: OrderStatus;
  productName: string;
  totalCents: number;
  emailMasked: string;
  createdAt: Date;
};

/** Visão pública mínima do pedido (sem CPF, nome ou e-mail completo). */
export async function getPublicOrder(orderId: string): Promise<PublicOrderView | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, productName: true, totalCents: true, customerEmail: true, createdAt: true },
  });
  if (!order) return null;
  const { customerEmail, ...rest } = order;
  return { ...rest, emailMasked: maskEmail(customerEmail) };
}
