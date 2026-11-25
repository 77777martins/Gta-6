-- Impressão digital da credencial do Mercado Pago que criou a preferência.
-- Pedidos antigos ficam com NULL e, portanto, ganham um link novo se reaproveitados.
ALTER TABLE "Order" ADD COLUMN "mpCredentialFp" VARCHAR(16);
