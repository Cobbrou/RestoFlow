-- CreateTable
CREATE TABLE "PeriodClosing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "closedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT NOT NULL,
    "closingsCount" INTEGER NOT NULL,
    "firstReport" TEXT,
    "lastReport" TEXT,
    "totalGross" REAL NOT NULL,
    "totalDiscounts" REAL NOT NULL,
    "totalNet" REAL NOT NULL,
    "totalHT" REAL NOT NULL,
    "totalVAT" REAL NOT NULL,
    "totalTips" REAL NOT NULL,
    "ticketsCount" INTEGER NOT NULL,
    "coversCount" INTEGER NOT NULL,
    "paymentsBreakdown" TEXT NOT NULL,
    "vatBreakdown" TEXT NOT NULL,
    "grandTotal" REAL NOT NULL,
    "previousHash" TEXT,
    "signature" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PeriodClosing_sequenceNumber_key" ON "PeriodClosing"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodClosing_reportNumber_key" ON "PeriodClosing"("reportNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodClosing_type_period_key" ON "PeriodClosing"("type", "period");
