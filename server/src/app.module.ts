import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { WebsocketModule } from "./websocket/websocket.module";
import { AuthModule } from "./auth/auth.module";
import { TablesModule } from "./tables/tables.module";
import { OrdersModule } from "./orders/orders.module";
import { CatalogModule } from "./catalog/catalog.module";
import { StaffModule } from "./staff/staff.module";

@Module({
  imports: [
    PrismaModule,
    WebsocketModule,
    AuthModule,
    TablesModule,
    OrdersModule,
    CatalogModule,
    StaffModule,
  ],
})
export class AppModule {}
