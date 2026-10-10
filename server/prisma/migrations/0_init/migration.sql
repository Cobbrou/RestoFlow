-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "avatarBg" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Staff_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "reserved" BOOLEAN NOT NULL DEFAULT false,
    "alert" BOOLEAN NOT NULL DEFAULT false,
    "reservationName" TEXT,
    "reservationPeople" INTEGER,
    "reservationTime" TEXT,
    "reservationNote" TEXT
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "vatRate" REAL NOT NULL DEFAULT 10,
    "station" TEXT NOT NULL DEFAULT 'kitchen'
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "happyHourPrice" REAL,
    "desc" TEXT NOT NULL,
    "emoji" TEXT DEFAULT '🍽️',
    "allergens" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "isMenu" BOOLEAN NOT NULL DEFAULT false,
    "vatRate" REAL NOT NULL DEFAULT 10,
    "station" TEXT NOT NULL DEFAULT 'kitchen',
    "options" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "currentStock" REAL NOT NULL DEFAULT 0,
    "minThreshold" REAL NOT NULL DEFAULT 5,
    "idealStock" REAL NOT NULL DEFAULT 20,
    "costPerUnit" REAL NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "supplierRef" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "isCritical" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    CONSTRAINT "RecipeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ingredientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitCost" REAL,
    "orderId" TEXT,
    "staffId" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "desc" TEXT NOT NULL,
    "emoji" TEXT DEFAULT '📋',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "groups" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "serverId" TEXT,
    "server" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "discount" TEXT,
    CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
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
    "options" TEXT,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "tableId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "ticketNumber" TEXT,
    "tableNumber" INTEGER,
    "server" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "subtotal" REAL,
    "discount" TEXT,
    "vatDetails" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "payments" TEXT NOT NULL,
    "sequenceNumber" INTEGER,
    "previousHash" TEXT,
    "signature" TEXT,
    "closedInZId" TEXT,
    "tip" REAL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'SALE',
    "refTicketNumber" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequenceNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "staffId" TEXT,
    "staffName" TEXT,
    "details" TEXT NOT NULL,
    "previousHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyClosing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequenceNumber" INTEGER NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT NOT NULL,
    "totalGross" REAL NOT NULL,
    "totalDiscounts" REAL NOT NULL,
    "totalNet" REAL NOT NULL,
    "totalHT" REAL NOT NULL,
    "totalVAT" REAL NOT NULL,
    "totalTips" REAL DEFAULT 0,
    "ticketsCount" INTEGER NOT NULL,
    "coversCount" INTEGER NOT NULL,
    "paymentsBreakdown" TEXT NOT NULL,
    "vatBreakdown" TEXT NOT NULL,
    "openingCash" REAL NOT NULL DEFAULT 0,
    "countedCash" REAL,
    "cashVariance" REAL,
    "grandTotalBefore" REAL NOT NULL,
    "grandTotal" REAL NOT NULL,
    "previousHash" TEXT,
    "signature" TEXT NOT NULL,
    "orderHistoryIds" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RestaurantConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT 'RestoFlow Bistrot',
    "legalName" TEXT NOT NULL DEFAULT 'RESTOFLOW SAS',
    "siret" TEXT NOT NULL DEFAULT '987 654 321 00012',
    "vatNumber" TEXT NOT NULL DEFAULT 'FR 12 987654321',
    "address" TEXT NOT NULL DEFAULT '14 Rue de la Paix',
    "city" TEXT NOT NULL DEFAULT '75002 Paris',
    "phone" TEXT NOT NULL DEFAULT '01 42 68 55 00',
    "email" TEXT NOT NULL DEFAULT 'contact@restoflow-bistrot.fr',
    "website" TEXT NOT NULL DEFAULT 'www.restoflow.fr',
    "footerNote" TEXT NOT NULL DEFAULT 'Merci de votre visite ! Service et taxes compris.',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "tpeAutoPrint" BOOLEAN NOT NULL DEFAULT true,
    "printers" TEXT NOT NULL DEFAULT '[]',
    "promoCodes" TEXT NOT NULL DEFAULT '[]',
    "happyHourConfig" TEXT DEFAULT '{"enabled":false,"startTime":"17:00","endTime":"20:00","days":[1,2,3,4,5],"discountPercent":20,"categories":["boissons"]}',
    "modulesConfig" TEXT DEFAULT '{"enableStockManagement":true,"enableOnlineReservations":true,"enableCoursePacing":true,"enableMultiStationKds":true,"enableDiscounts":true,"enableAdvancedSplitModes":true,"enablePinAuth":true,"enableTips":true}',
    "fecExportConfig" TEXT DEFAULT '{"journalCode":"VT","accountVente10":"706000","accountVente20":"707000","accountVat10":"445710","accountVat20":"445720","accountCard":"512000","accountCash":"530000","accountOther":"580000"}',
    "grandTotal" REAL NOT NULL DEFAULT 0,
    "lastClosingDate" DATETIME,
    "nf525Key" TEXT DEFAULT 'RESTOFLOW_NF525_SECRET_KEY',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProcessedAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "handler" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Table_number_key" ON "Table"("number");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_productId_ingredientId_key" ON "RecipeItem"("productId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderHistory_orderId_key" ON "OrderHistory"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderHistory_ticketNumber_key" ON "OrderHistory"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OrderHistory_sequenceNumber_key" ON "OrderHistory"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EventLog_sequenceNumber_key" ON "EventLog"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClosing_sequenceNumber_key" ON "DailyClosing"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DailyClosing_reportNumber_key" ON "DailyClosing"("reportNumber");

