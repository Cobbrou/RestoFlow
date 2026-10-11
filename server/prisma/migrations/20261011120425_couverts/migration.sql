-- AlterTable
ALTER TABLE "Order" ADD COLUMN "covers" INTEGER;

-- AlterTable
ALTER TABLE "OrderHistory" ADD COLUMN "covers" INTEGER;

-- Trigger NF525 recréé au démarrage (PrismaService) avec les colonnes tip et covers figées
DROP TRIGGER IF EXISTS nf525_ticket_frozen;
