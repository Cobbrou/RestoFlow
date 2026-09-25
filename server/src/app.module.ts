import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { WebsocketModule } from "./websocket/websocket.module";
import { AuthModule } from "./auth/auth.module";
import { TablesModule } from "./tables/tables.module";
import { OrdersModule } from "./orders/orders.module";
import { CatalogModule } from "./catalog/catalog.module";
import { StaffModule } from "./staff/staff.module";
import { StockModule } from "./stock/stock.module";
import { RecipesModule } from "./recipes/recipes.module";
import { BillingModule } from "./billing/billing.module";
import { ConfigModule } from "./config/config.module";
import { PrinterModule } from "./printer/printer.module";

@Module({
  imports: [
    PrismaModule,
    WebsocketModule,
    AuthModule,
    TablesModule,
    OrdersModule,
    CatalogModule,
    StaffModule,
    StockModule,
    RecipesModule,
    BillingModule,
    ConfigModule,
    PrinterModule,
  ],
})
export class AppModule {}
