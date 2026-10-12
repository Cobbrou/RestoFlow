import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ManagementService } from "./management.service";
import { ManagementGateway } from "./management.gateway";

@Module({
  imports: [AuthModule],
  providers: [ManagementService, ManagementGateway],
  exports: [ManagementService],
})
export class ManagementModule {}
