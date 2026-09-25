import { Module } from "@nestjs/common";
import { ConfigService } from "./config.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
