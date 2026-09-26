import { Module } from "@nestjs/common";
import { WebsocketGateway } from "./websocket.gateway";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { OrdersModule } from "../orders/orders.module";
import { BillingModule } from "../billing/billing.module";
import { ConfigModule } from "../config/config.module";
import { StockModule } from "../stock/stock.module";
import { TablesModule } from "../tables/tables.module";
import { PrinterModule } from "../printer/printer.module";
import { RecipesModule } from "../recipes/recipes.module";
import { ClosingModule } from "../closing/closing.module";
import { CatalogModule } from "../catalog/catalog.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrdersModule,
    BillingModule,
    ConfigModule,
    StockModule,
    TablesModule,
    PrinterModule,
    RecipesModule,
    ClosingModule,
    CatalogModule,
  ],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
