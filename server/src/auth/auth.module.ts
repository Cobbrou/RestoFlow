import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { WsAuthGuard } from "./guards/ws-auth.guard";
import { WsPermissionsGuard } from "./guards/ws-permissions.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, WsAuthGuard, WsPermissionsGuard],
  exports: [AuthService, WsAuthGuard, WsPermissionsGuard],
})
export class AuthModule {}
