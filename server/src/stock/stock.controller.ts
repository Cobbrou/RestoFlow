import { Controller, Get, Post, Put, Delete, Body, Param, Query } from "@nestjs/common";
import { StockService } from "./stock.service";

@Controller("stock")
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get("ingredients")
  async getIngredients() {
    return this.stockService.findAllIngredients();
  }

  @Get("summary")
  async getSummary() {
    return this.stockService.getInventorySummary();
  }

  @Get("movements")
  async getMovements(@Query("limit") limit?: string) {
    const lim = limit ? parseInt(limit, 10) : 100;
    return this.stockService.getMovements(lim);
  }

  @Post("ingredients")
  async createIngredient(@Body() body: any) {
    return this.stockService.createIngredient(body);
  }

  @Put("ingredients/:id")
  async updateIngredient(@Param("id") id: string, @Body() body: any) {
    return this.stockService.updateIngredient(id, body);
  }

  @Delete("ingredients/:id")
  async deleteIngredient(@Param("id") id: string) {
    return this.stockService.deleteIngredient(id);
  }

  @Post("movements")
  async addMovement(@Body() body: any) {
    return this.stockService.recordMovement(body);
  }
}
