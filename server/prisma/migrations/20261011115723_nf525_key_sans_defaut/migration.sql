-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RestaurantConfig" (
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
    "nf525Key" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RestaurantConfig" ("address", "city", "currency", "email", "fecExportConfig", "footerNote", "grandTotal", "happyHourConfig", "id", "lastClosingDate", "legalName", "modulesConfig", "name", "nf525Key", "phone", "printers", "promoCodes", "siret", "tpeAutoPrint", "updatedAt", "vatNumber", "website") SELECT "address", "city", "currency", "email", "fecExportConfig", "footerNote", "grandTotal", "happyHourConfig", "id", "lastClosingDate", "legalName", "modulesConfig", "name", "nf525Key", "phone", "printers", "promoCodes", "siret", "tpeAutoPrint", "updatedAt", "vatNumber", "website" FROM "RestaurantConfig";
DROP TABLE "RestaurantConfig";
ALTER TABLE "new_RestaurantConfig" RENAME TO "RestaurantConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
