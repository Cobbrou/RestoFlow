import { Module } from "@nestjs/common";
import { ClosingService } from "./closing.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ConfigModule } from "../config/config.module";

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [ClosingService],
  exports: [ClosingService],
})
export class ClosingModule {}
