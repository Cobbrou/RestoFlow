import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.category.findMany();
  }

  async getProducts() {
    const products = await this.prisma.product.findMany();
    return products.map((p) => ({
      ...p,
      emoji: p.emoji || "🍽️",
      allergens: JSON.parse(p.allergens || "[]"),
    }));
  }

  async getMenus() {
    const menus = await this.prisma.menu.findMany();
    return menus.map((m) => ({
      ...m,
      emoji: m.emoji || "📋",
      groups: JSON.parse(m.groups || "[]"),
    }));
  }
}
