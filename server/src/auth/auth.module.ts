import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { WsAuthGuard } from "./guards/ws-auth.guard";
import { WsPermissionsGuard } from "./guards/ws-permissions.guard";
import { HttpAuthGuard } from "./guards/http-auth.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, WsAuthGuard, WsPermissionsGuard, { provide: APP_GUARD, useClass: HttpAuthGuard }],
  exports: [AuthService, WsAuthGuard, WsPermissionsGuard],
})
export class AuthModule {}
