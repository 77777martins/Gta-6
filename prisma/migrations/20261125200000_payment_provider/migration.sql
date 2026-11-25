-- Suporte a múltiplos provedores de pagamento (Mercado Pago e Pixoupay).
ALTER TABLE "Payment" ADD COLUMN "provider" VARCHAR(16) NOT NULL DEFAULT 'mercadopago';
ALTER TABLE "Payment" ADD COLUMN "pixCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN "pixQrBase64" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "id" TYPE VARCHAR(64);

-- O formato do id passa a depender do provedor.
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_id_digits";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_provider_valid" CHECK ("provider" IN ('mercadopago', 'pixoupay'));
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_id_format" CHECK (
  ("provider" = 'mercadopago' AND "id" ~ '^[0-9]{1,32}$')
  OR ("provider" = 'pixoupay' AND "id" ~ '^[0-9a-f-]{36}$')
);

CREATE INDEX "Payment_provider_idx" ON "Payment"("provider");
