import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeOptionGroups } from "../billing/pricing";
import { numOr } from "../stock/stock.service";

/**
 * Créneaux de vente « 11:30-14:30, 19:00-22:30 » (fin après minuit admise : « 22:00-02:00 »).
 * Vide → null (toute la journée) ; format invalide → refus.
 */
export function normalizeHours(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const slots = text.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const invalid = () => new BadRequestException(`Créneau horaire invalide : « ${text} » (ex. 11:30-14:30, 19:00-22:30)`);
  const norm = (t: string) => {
    const m = t.trim().match(/^([01]?\d|2[0-3])[:h]([0-5]\d)$/);
    if (!m) throw invalid();
    return `${m[1].padStart(2, "0")}:${m[2]}`;
  };
  return slots
    .map((slot) => {
      const parts = slot.split("-");
      if (parts.length !== 2) throw invalid();
      const [start, end] = parts.map(norm);
      if (start === end) throw invalid();
      return `${start}-${end}`;
    })
    .join(", ");
}

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async getProducts() {
    const products = await this.prisma.product.findMany();
    return products.map((p) => ({
      ...p,
      emoji: p.emoji || "🍽️",
      allergens: JSON.parse(p.allergens || "[]"),
      options: JSON.parse(p.options || "[]"),
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
    options?: unknown;
    hours?: string | null;
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
        options: JSON.stringify(normalizeOptionGroups(data.options)),
        hours: normalizeHours(data.hours),
      },
    });

    return {
      ...product,
      emoji: product.emoji || "🍽️",
      allergens: JSON.parse(product.allergens || "[]"),
      options: JSON.parse(product.options || "[]"),
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
    options?: unknown;
    hours?: string | null;
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
    const minThreshold = numOr(data.minThreshold, 5);
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
          options: JSON.stringify(normalizeOptionGroups(data.options)),
          hours: normalizeHours(data.hours),
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
          options: JSON.parse(product.options || "[]"),
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
    if (data.options !== undefined) patch.options = JSON.stringify(normalizeOptionGroups(data.options));
    if (data.hours !== undefined) patch.hours = normalizeHours(data.hours);

    const updated = await this.prisma.product.update({
      where: { id },
      data: patch,
    });

    return {
      ...updated,
      emoji: updated.emoji || "🍽️",
      allergens: JSON.parse(updated.allergens || "[]"),
      options: JSON.parse(updated.options || "[]"),
    };
  }

  async deleteProduct(id: string) {
    // Delete recipe items first (cascade or explicit)
    await this.prisma.recipeItem.deleteMany({ where: { productId: id } });
    return this.prisma.product.delete({ where: { id } });
  }
}
