import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface RecipeItemPayload {
  ingredientId: string;
  quantity: number;
  unit: string;
  isCritical?: boolean;
  notes?: string;
}

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const products = await this.prisma.product.findMany({
      where: { isMenu: false },
      include: {
        recipeItems: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return products.map((product) => {
      let portionCost = 0;
      let minPortionsAvailable = Infinity;

      const items = product.recipeItems.map((rc) => {
        const ing = rc.ingredient;
        const lineCost = rc.quantity * ing.costPerUnit;
        portionCost += lineCost;

        // Portions réalisables avec le stock restant
        if (rc.isCritical && rc.quantity > 0) {
          const possible = Math.floor(ing.currentStock / rc.quantity);
          if (possible < minPortionsAvailable) {
            minPortionsAvailable = Math.max(0, possible);
          }
        }

        return {
          id: rc.id,
          ingredientId: rc.ingredientId,
          ingredientName: ing.name,
          category: ing.category,
          unit: rc.unit,
          quantity: rc.quantity,
          costPerUnit: ing.costPerUnit,
          lineCost: Number(lineCost.toFixed(4)),
          currentStock: ing.currentStock,
          stockUnit: ing.unit,
          isCritical: rc.isCritical,
          notes: rc.notes || "",
        };
      });

      if (items.length === 0 || minPortionsAvailable === Infinity) {
        minPortionsAvailable = product.available ? 99 : 0;
      }

      // PV HT (TVA)
      const pvTTC = product.price;
      const vatRate = product?.vatRate || 10;
      const pvHT = pvTTC / (1 + vatRate / 100);
      const roundedPortionCost = Number(portionCost.toFixed(2));
      const grossMarginHT = Number((pvHT - roundedPortionCost).toFixed(2));
      const marginRate = pvHT > 0 ? Number(((grossMarginHT / pvHT) * 100).toFixed(1)) : 0;
      const foodCostRate = pvHT > 0 ? Number(((roundedPortionCost / pvHT) * 100).toFixed(1)) : 0;
      const multiplier = roundedPortionCost > 0 ? Number((pvTTC / roundedPortionCost).toFixed(2)) : 0;

      // Status rentabilité
      const profitabilityStatus =
        items.length === 0
          ? "undefined"
          : foodCostRate <= 28
          ? "optimal"
          : foodCostRate <= 35
          ? "warning"
          : "critical";

      return {
        productId: product.id,
        productName: product.name,
        category: product.cat,
        priceTTC: pvTTC,
        priceHT: Number(pvHT.toFixed(2)),
        available: product.available,
        items,
        metrics: {
          portionCost: roundedPortionCost,
          grossMarginHT,
          marginRate,
          foodCostRate,
          multiplier,
          profitabilityStatus,
          portionsAvailable: minPortionsAvailable,
        },
      };
    });
  }

  async findByProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        recipeItems: {
          include: { ingredient: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit introuvable : ${productId}`);
    }

    return product;
  }

  async saveRecipe(productId: string, items: RecipeItemPayload[]) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Produit introuvable : ${productId}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Supprimer l'ancienne composition
      await tx.recipeItem.deleteMany({ where: { productId } });

      // 2. Créer les nouveaux ingrédients de la recette
      for (const item of items) {
        if (!item.ingredientId || Number(item.quantity) <= 0) continue;
        await tx.recipeItem.create({
          data: {
            id: `rc_${productId}_${item.ingredientId}`,
            productId,
            ingredientId: item.ingredientId,
            quantity: Number(item.quantity),
            unit: item.unit,
            isCritical: item.isCritical ?? true,
            notes: item.notes || null,
          },
        });
      }

      return tx.recipeItem.findMany({
        where: { productId },
        include: { ingredient: true },
      });
    });
  }

  async deleteRecipe(productId: string) {
    return this.prisma.recipeItem.deleteMany({ where: { productId } });
  }
}
