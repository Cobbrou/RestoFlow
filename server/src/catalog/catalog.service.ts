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

  async createProduct(data: {
    id?: string;
    name: string;
    cat: string;
    price: number;
    happyHourPrice?: number | null;
    desc?: string;
    emoji?: string;
    allergens?: string[] | string;
    available?: boolean;
    station?: string;
    vatRate?: number;
  }) {
    const id = data.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const allergensStr = Array.isArray(data.allergens)
      ? JSON.stringify(data.allergens)
      : typeof data.allergens === "string"
      ? data.allergens
      : "[]";

    const product = await this.prisma.product.create({
      data: {
        id,
        name: data.name,
        cat: data.cat,
        price: Number(data.price),
        happyHourPrice: data.happyHourPrice != null ? Number(data.happyHourPrice) : null,
        desc: data.desc || "",
        emoji: data.emoji || "🍽️",
        allergens: allergensStr,
        available: data.available !== undefined ? Boolean(data.available) : true,
        station: data.station || (["boissons", "bieres", "vins", "cafes"].includes(data.cat) ? "bar" : "kitchen"),
        vatRate: data.vatRate || (["boissons", "bieres", "vins"].includes(data.cat) ? 20 : 10),
      },
    });

    return {
      ...product,
      emoji: product.emoji || "🍽️",
      allergens: JSON.parse(product.allergens || "[]"),
    };
  }

  async createProductWithStock(data: {
    id?: string;
    name: string;
    cat: string;
    price: number;
    happyHourPrice?: number | null;
    desc?: string;
    emoji?: string;
    allergens?: string[] | string;
    available?: boolean;
    station?: string;
    vatRate?: number;
    initialStock: number;
    minThreshold?: number;
    costPerUnit?: number;
  }) {
    const productId = data.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ingredientId = `ing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const recipeId = `rc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const allergensStr = Array.isArray(data.allergens)
      ? JSON.stringify(data.allergens)
      : typeof data.allergens === "string"
      ? data.allergens
      : "[]";

    const ingCategory = ["boissons", "bieres", "vins", "cafes"].includes(data.cat) ? "Boissons" : "Épicerie";
    const initialStock = Number(data.initialStock) || 0;
    const minThreshold = Number(data.minThreshold) || 5;
    const costPerUnit = Number(data.costPerUnit) || 0;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Créer le produit
      const product = await tx.product.create({
        data: {
          id: productId,
          name: data.name,
          cat: data.cat,
          price: Number(data.price),
          happyHourPrice: data.happyHourPrice != null ? Number(data.happyHourPrice) : null,
          desc: data.desc || "",
          emoji: data.emoji || "🍽️",
          allergens: allergensStr,
          available: initialStock > 0 ? (data.available !== undefined ? Boolean(data.available) : true) : false,
          station: data.station || (["boissons", "bieres", "vins", "cafes"].includes(data.cat) ? "bar" : "kitchen"),
          vatRate: data.vatRate || (["boissons", "bieres", "vins"].includes(data.cat) ? 20 : 10),
        },
      });

      // 2. Créer l'ingrédient associé
      const ingredient = await tx.ingredient.create({
        data: {
          id: ingredientId,
          name: data.name,
          category: ingCategory,
          unit: "piece",
          currentStock: initialStock,
          minThreshold: minThreshold,
          idealStock: Math.max(20, initialStock * 1.5),
          costPerUnit: costPerUnit,
          supplier: null,
        },
      });

      // 3. Mouvement initial de stock
      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ingredientId: ingredientId,
            type: "DELIVERY",
            quantity: initialStock,
            unitCost: costPerUnit,
            reason: `Stock initial lors de la création du produit "${data.name}"`,
          },
        });
      }

      // 4. Fiche technique 1:1
      await tx.recipeItem.create({
        data: {
          id: recipeId,
          productId: productId,
          ingredientId: ingredientId,
          quantity: 1,
          unit: "piece",
          isCritical: true,
          notes: "Suivi de stock direct unitaire",
        },
      });

      return {
        product: {
          ...product,
          emoji: product.emoji || "🍽️",
          allergens: JSON.parse(product.allergens || "[]"),
        },
        ingredient,
      };
    });
  }

  async updateProduct(id: string, data: any) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new Error(`Produit introuvable : ${id}`);

    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.cat !== undefined) patch.cat = data.cat;
    if (data.price !== undefined) patch.price = Number(data.price);
    if (data.happyHourPrice !== undefined) {
      patch.happyHourPrice = data.happyHourPrice != null ? Number(data.happyHourPrice) : null;
    }
    if (data.desc !== undefined) patch.desc = data.desc;
    if (data.emoji !== undefined) patch.emoji = data.emoji;
    if (data.allergens !== undefined) {
      patch.allergens = Array.isArray(data.allergens)
        ? JSON.stringify(data.allergens)
        : typeof data.allergens === "string"
        ? data.allergens
        : "[]";
    }
    if (data.available !== undefined) patch.available = Boolean(data.available);
    if (data.station !== undefined) patch.station = data.station;
    if (data.vatRate !== undefined) patch.vatRate = Number(data.vatRate);

    const updated = await this.prisma.product.update({
      where: { id },
      data: patch,
    });

    return {
      ...updated,
      emoji: updated.emoji || "🍽️",
      allergens: JSON.parse(updated.allergens || "[]"),
    };
  }

  async deleteProduct(id: string) {
    // Delete recipe items first (cascade or explicit)
    await this.prisma.recipeItem.deleteMany({ where: { productId: id } });
    return this.prisma.product.delete({ where: { id } });
  }
}
