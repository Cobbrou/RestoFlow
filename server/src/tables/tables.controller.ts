import { Controller, Get, Param } from "@nestjs/common";
import { TablesService } from "./tables.service";

@Controller("api/tables")
export class TablesController {
  constructor(private tablesService: TablesService) {}

  @Get()
  findAll() {
    return this.tablesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.tablesService.findOne(id);
  }
  // Création / modification / suppression : événements table:* (ManagementGateway, validés et diffusés)
}
