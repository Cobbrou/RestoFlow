-- CreateIndex
CREATE INDEX "Order_status_tableId_idx" ON "Order"("status", "tableId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderHistory_createdAt_idx" ON "OrderHistory"("createdAt");

-- CreateIndex
CREATE INDEX "OrderHistory_closedInZId_idx" ON "OrderHistory"("closedInZId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Reservation_date_idx" ON "Reservation"("date");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
