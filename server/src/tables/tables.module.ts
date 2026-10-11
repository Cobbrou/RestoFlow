import { Module } from "@nestjs/common";
import { TablesService } from "./tables.service";

@Module({
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
