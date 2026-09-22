import { Controller, Get, Query } from "@nestjs/common";
import { OrdersService } from "./orders.service";

@Controller("api/orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get("active")
  findActive() {
    return this.ordersService.findActive();
  }

  @Get("history")
  findHistory(@Query("limit") limit?: string) {
    return this.ordersService.findHistory(limit ? parseInt(limit, 10) : 100);
  }
}
