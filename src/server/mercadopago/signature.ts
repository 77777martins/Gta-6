import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";

/**
 * Validação de autenticidade do webhook usando o validador oficial do SDK:
 * HMAC-SHA256 sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;",
 * comparação em tempo constante e rejeição de timestamps antigos (replay).
 */
export const WEBHOOK_TOLERANCE_SECONDS = 600;

export type SignatureInput = {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
  now?: () => number;
};

export type SignatureResult = { valid: true } | { valid: false; reason: string };

export function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret, now }: SignatureInput): SignatureResult {
  if (!secret) return { valid: false, reason: "MissingSecret" };
  // Pela documentação do MP, data.id alfanumérico entra no manifesto em minúsculas.
  const normalizedId = dataId && /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId: normalizedId,
      secret,
      toleranceSeconds: WEBHOOK_TOLERANCE_SECONDS,
      ...(now ? { now } : {}),
    });
    return { valid: true };
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) return { valid: false, reason: error.reason };
    return { valid: false, reason: "UnexpectedError" };
  }
}
