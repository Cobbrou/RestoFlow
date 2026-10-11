-- RedefineTables
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
    "covers" INTEGER,
    "paidTotal" REAL NOT NULL DEFAULT 0,
    "externalRef" TEXT,
    CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("channel", "covers", "createdAt", "customerName", "customerPhone", "discount", "externalRef", "id", "pickupAt", "pickupNumber", "sentAt", "server", "serverId", "status", "tableId", "type") SELECT "channel", "covers", "createdAt", "customerName", "customerPhone", "discount", "externalRef", "id", "pickupAt", "pickupNumber", "sentAt", "server", "serverId", "status", "tableId", "type" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_channel_externalRef_key" ON "Order"("channel", "externalRef");
CREATE TABLE "new_OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isMenu" BOOLEAN NOT NULL DEFAULT false,
    "composition" TEXT,
    "course" TEXT NOT NULL DEFAULT 'direct',
    "courseStatus" TEXT NOT NULL DEFAULT 'direct',
    "station" TEXT NOT NULL DEFAULT 'kitchen',
    "vatRate" REAL NOT NULL DEFAULT 10,
    "paidQty" INTEGER NOT NULL DEFAULT 0,
    "vatSplit" TEXT,
    "options" TEXT,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("composition", "course", "courseStatus", "id", "isMenu", "name", "notes", "options", "orderId", "price", "productId", "qty", "station", "status", "vatRate", "vatSplit") SELECT "composition", "course", "courseStatus", "id", "isMenu", "name", "notes", "options", "orderId", "price", "productId", "qty", "station", "status", "vatRate", "vatSplit" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
