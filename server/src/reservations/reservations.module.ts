import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReservationsService } from "./reservations.service";
import { ReservationsGateway } from "./reservations.gateway";

@Module({
  imports: [AuthModule],
  providers: [ReservationsService, ReservationsGateway],
})
export class ReservationsModule {}
