import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { conversionFactor } from "./units";

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

  /** Lignes de fiches techniques au format client (sync:init, recipe:updated) */
  async listItems() {
    const recipes = await this.prisma.recipeItem.findMany({
      include: { ingredient: { select: { name: true, costPerUnit: true, currentStock: true, unit: true } } },
    });
    return recipes.map((rc) => ({
      id: rc.id,
      productId: rc.productId,
      ingredientId: rc.ingredientId,
      ingredientName: rc.ingredient.name,
      quantity: rc.quantity,
      unit: rc.unit,
      stockUnit: rc.ingredient.unit,
      costPerUnit: rc.ingredient.costPerUnit,
      currentStock: rc.ingredient.currentStock,
      isCritical: rc.isCritical,
      notes: rc.notes || "",
    }));
  }

  async saveRecipe(productId: string, items: RecipeItemPayload[]) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Produit introuvable : ${productId}`);
    }

    // Dosage et stock doivent se convertir (g ↔ kg, cl ↔ l…) : sinon le déstockage serait faux
    const ingredients = await this.prisma.ingredient.findMany({
      where: { id: { in: items.map((i) => i.ingredientId).filter(Boolean) } },
      select: { id: true, name: true, unit: true },
    });
    for (const item of items) {
      const ing = ingredients.find((i) => i.id === item.ingredientId);
      if (ing && conversionFactor(item.unit || ing.unit, ing.unit) === null) {
        throw new BadRequestException(`${ing.name} : dosage en « ${item.unit} » incompatible avec le stock en « ${ing.unit} »`);
      }
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
}
