import { Controller, Get } from "@nestjs/common";
import { CatalogService } from "./catalog.service";

@Controller("api/catalog")
export class CatalogController {
  constructor(private catalogService: CatalogService) {}

  @Get("categories")
  getCategories() {
    return this.catalogService.getCategories();
  }

  @Get("products")
  getProducts() {
    return this.catalogService.getProducts();
  }

  @Get("menus")
  getMenus() {
    return this.catalogService.getMenus();
  }
}
