-- EPIC #2 E2-2: inventory runtime — stock movement ledger.
-- Additive only — two enums + one new table. No existing column
-- or row is touched; every tenant keeps its current behavior
-- (Product/ProductVariant.stockQuantity remains the STATE, the
-- new table is the LEDGER behind it).

-- ------------------------------------------------------------
-- StockMovement — ONE stock event per row (receipt / issue).
--   direction IN/OUT, quantity always > 0 (validated in actions);
--   source: MANUAL (owner-entered on the product) or ORDER
--   (shop checkout verification wrote the issue).
--   Traceability: optional soft links to ExtensionRecord rows
--   (supplier / batch) — provenance without duplicating the
--   extension registry (§9.6).
-- ------------------------------------------------------------
CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT');

CREATE TYPE "StockMovementSource" AS ENUM ('MANUAL', 'ORDER');

CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "direction" "StockDirection" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" "StockMovementSource" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "orderId" TEXT,
    "supplierRecordId" TEXT,
    "batchRecordId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_idx" ON "StockMovement"("organizationId");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_productId_idx" ON "StockMovement"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_supplierRecordId_fkey" FOREIGN KEY ("supplierRecordId") REFERENCES "ExtensionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchRecordId_fkey" FOREIGN KEY ("batchRecordId") REFERENCES "ExtensionRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
