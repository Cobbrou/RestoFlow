import { Controller, Get, Post, Put, Delete, Body, Param } from "@nestjs/common";
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

  @Post()
  create(@Body() body: any) {
    return this.tablesService.create(body);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.tablesService.update(id, body);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.tablesService.delete(id);
  }
}
