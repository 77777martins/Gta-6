-- CreateSchema

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('PS5', 'XBOX_SERIES');

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "idempotencyKey" VARCHAR(64) NOT NULL,
    "customerName" VARCHAR(120) NOT NULL,
    "customerEmail" VARCHAR(254) NOT NULL,
    "customerCpf" CHAR(11) NOT NULL,
    "customerPhone" VARCHAR(11),
    "platform" "Platform" NOT NULL,
    "productSku" VARCHAR(64) NOT NULL,
    "productName" VARCHAR(160) NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "mpPreferenceId" VARCHAR(128),
    "mpCheckoutUrl" VARCHAR(512),
    "paidAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" VARCHAR(32) NOT NULL,
    "orderId" UUID NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "statusDetail" VARCHAR(64),
    "paymentMethodId" VARCHAR(32),
    "paymentTypeId" VARCHAR(32),
    "amountCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amountMatches" BOOLEAN NOT NULL,
    "mpDateApproved" TIMESTAMP(3),
    "mpDateLastUpdated" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_mpPreferenceId_key" ON "Order"("mpPreferenceId");

-- CreateIndex
CREATE INDEX "Order_customerEmail_createdAt_idx" ON "Order"("customerEmail", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Constraints de integridade que o schema Prisma não expressa.
ALTER TABLE "Order" ADD CONSTRAINT "Order_totalCents_positive" CHECK ("totalCents" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_unitPriceCents_positive" CHECK ("unitPriceCents" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_consistent" CHECK ("totalCents" = "unitPriceCents" * "quantity");
ALTER TABLE "Order" ADD CONSTRAINT "Order_cpf_digits" CHECK ("customerCpf" ~ '^[0-9]{11}$');
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_id_digits" CHECK ("id" ~ '^[0-9]{1,32}$');
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_non_negative" CHECK ("amountCents" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_phone_digits" CHECK ("customerPhone" IS NULL OR "customerPhone" ~ '^[1-9]{2}[0-9]{8,9}$');
