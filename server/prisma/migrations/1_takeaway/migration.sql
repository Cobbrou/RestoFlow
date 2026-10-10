-- Commandes hors salle (emporter, puis téléphone / en ligne / plateformes) : table facultative, mode et canal de commande

-- RedefineTables (SQLite ne sait pas rendre une colonne facultative sans reconstruire la table)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT,
    "serverId" TEXT,
    "server" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "discount" TEXT,
    "type" TEXT NOT NULL DEFAULT 'dine_in',
    "channel" TEXT NOT NULL DEFAULT 'pos',
    "customerName" TEXT,
    "customerPhone" TEXT,
    "pickupAt" DATETIME,
    "pickupNumber" INTEGER,
    "externalRef" TEXT,
    CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "discount", "id", "sentAt", "server", "serverId", "status", "tableId") SELECT "createdAt", "discount", "id", "sentAt", "server", "serverId", "status", "tableId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_channel_externalRef_key" ON "Order"("channel", "externalRef");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Tickets NF525 : simples ajouts de colonnes, la table n'est jamais reconstruite
ALTER TABLE "OrderHistory" ADD COLUMN "orderType" TEXT NOT NULL DEFAULT 'dine_in';
ALTER TABLE "OrderHistory" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'pos';
ALTER TABLE "OrderHistory" ADD COLUMN "orderLabel" TEXT;

-- Le trigger d'inaltérabilité est recréé au démarrage avec les nouvelles colonnes (prisma.service.ts)
DROP TRIGGER IF EXISTS nf525_ticket_frozen;
