import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { JournalModule } from "./journal/journal.module";
import { WebsocketModule } from "./websocket/websocket.module";
import { AuthModule } from "./auth/auth.module";
import { TablesModule } from "./tables/tables.module";
import { OrdersModule } from "./orders/orders.module";
import { CatalogModule } from "./catalog/catalog.module";
import { StockModule } from "./stock/stock.module";
import { RecipesModule } from "./recipes/recipes.module";
import { BillingModule } from "./billing/billing.module";
import { ConfigModule } from "./config/config.module";
import { PrinterModule } from "./printer/printer.module";
import { ClosingModule } from "./closing/closing.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { ManagementModule } from "./management/management.module";

@Module({
  imports: [
    PrismaModule,
    JournalModule,
    WebsocketModule,
    AuthModule,
    TablesModule,
    OrdersModule,
    CatalogModule,
    StockModule,
    RecipesModule,
    BillingModule,
    ConfigModule,
    PrinterModule,
    ClosingModule,
    ReservationsModule,
    ManagementModule,
  ],
})
export class AppModule {}
