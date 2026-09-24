import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface StockMovementInput {
  ingredientId: string;
  type: "DELIVERY" | "WASTE" | "ADJUSTMENT" | "ORDER_CONSUMPTION" | "CANCEL_RETURN";
  quantity: number; // positive for additions/deliveries, negative for waste/consumption
  unitCost?: number;
  orderId?: string;
  staffId?: string;
  reason?: string;
}

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  async findAllIngredients() {
    const ingredients = await this.prisma.ingredient.findMany({
      orderBy: { name: "asc" },
      include: {
        recipeItems: {
          include: {
            product: {
              select: { id: true, name: true, price: true, available: true },
            },
          },
        },
      },
    });

    return ingredients.map((ing) => {
      const isOut = ing.currentStock <= 0;
      const isLow = !isOut && ing.currentStock <= ing.minThreshold;
      const status = isOut ? "out" : isLow ? "low" : "ok";
      return {
        ...ing,
        status,
        stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
      };
    });
  }

  async getInventorySummary() {
    const ingredients = await this.prisma.ingredient.findMany();
    const totalItems = ingredients.length;
    let outCount = 0;
    let lowCount = 0;
    let totalValue = 0;

    for (const ing of ingredients) {
      if (ing.currentStock <= 0) {
        outCount++;
      } else if (ing.currentStock <= ing.minThreshold) {
        lowCount++;
      }
      totalValue += ing.currentStock * ing.costPerUnit;
    }

    return {
      totalItems,
      outCount,
      lowCount,
      okCount: totalItems - outCount - lowCount,
      totalStockValue: Number(totalValue.toFixed(2)),
    };
  }

  async createIngredient(data: {
    id?: string;
    name: string;
    category: string;
    unit: string;
    currentStock: number;
    minThreshold: number;
    idealStock: number;
    costPerUnit: number;
    supplier?: string;
    supplierRef?: string;
  }) {
    const id = data.id || `ing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const created = await this.prisma.ingredient.create({
      data: {
        id,
        name: data.name,
        category: data.category,
        unit: data.unit,
        currentStock: Number(data.currentStock) || 0,
        minThreshold: Number(data.minThreshold) || 5,
        idealStock: Number(data.idealStock) || 20,
        costPerUnit: Number(data.costPerUnit) || 0,
        supplier: data.supplier || null,
        supplierRef: data.supplierRef || null,
      },
    });

    if (data.currentStock > 0) {
      await this.prisma.stockMovement.create({
        data: {
          id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ingredientId: id,
          type: "DELIVERY",
          quantity: Number(data.currentStock),
          unitCost: Number(data.costPerUnit),
          reason: "Création de l'ingrédient & stock initial",
        },
      });
    }

    return created;
  }

  async updateIngredient(
    id: string,
    data: {
      name?: string;
      category?: string;
      unit?: string;
      minThreshold?: number;
      idealStock?: number;
      costPerUnit?: number;
      supplier?: string;
      supplierRef?: string;
    }
  ) {
    const existing = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Ingrédient introuvable : ${id}`);

    return this.prisma.ingredient.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        category: data.category ?? existing.category,
        unit: data.unit ?? existing.unit,
        minThreshold: data.minThreshold !== undefined ? Number(data.minThreshold) : existing.minThreshold,
        idealStock: data.idealStock !== undefined ? Number(data.idealStock) : existing.idealStock,
        costPerUnit: data.costPerUnit !== undefined ? Number(data.costPerUnit) : existing.costPerUnit,
        supplier: data.supplier !== undefined ? data.supplier : existing.supplier,
        supplierRef: data.supplierRef !== undefined ? data.supplierRef : existing.supplierRef,
      },
    });
  }

  async deleteIngredient(id: string) {
    const recipeUsage = await this.prisma.recipeItem.count({ where: { ingredientId: id } });
    if (recipeUsage > 0) {
      throw new BadRequestException(
        "Impossible de supprimer cet ingrédient car il est utilisé dans une ou plusieurs fiches techniques"
      );
    }
    return this.prisma.ingredient.delete({ where: { id } });
  }

  async recordMovement(input: StockMovementInput) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: input.ingredientId },
      include: {
        recipeItems: {
          include: { product: true },
        },
      },
    });

    if (!ingredient) {
      throw new NotFoundException(`Ingrédient ${input.ingredientId} non trouvé`);
    }

    const newStock = Math.max(0, ingredient.currentStock + input.quantity);
    const movementId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Transaction atomique
    const [updatedIngredient, movement] = await this.prisma.$transaction([
      this.prisma.ingredient.update({
        where: { id: input.ingredientId },
        data: {
          currentStock: newStock,
          costPerUnit: input.unitCost !== undefined && input.unitCost > 0 ? input.unitCost : ingredient.costPerUnit,
        },
      }),
      this.prisma.stockMovement.create({
        data: {
          id: movementId,
          ingredientId: input.ingredientId,
          type: input.type,
          quantity: input.quantity,
          unitCost: input.unitCost ?? ingredient.costPerUnit,
          orderId: input.orderId || null,
          staffId: input.staffId || null,
          reason: input.reason || null,
        },
      }),
    ]);

    // Rupture en cascade : si newStock <= 0, basculer tous les produits dépendants critiques en available: false
    const affectedProducts: string[] = [];
    if (newStock <= 0) {
      for (const item of ingredient.recipeItems) {
        if (item.isCritical && item.product.available) {
          await this.prisma.product.update({
            where: { id: item.productId },
            data: { available: false },
          });
          affectedProducts.push(item.productId);
        }
      }
    } else if (ingredient.currentStock <= 0 && newStock > 0) {
      // Si on revient en stock positif, réactiver les produits si tous leurs ingrédients critiques sont OK
      for (const item of ingredient.recipeItems) {
        if (!item.product.available) {
          const allCritical = await this.prisma.recipeItem.findMany({
            where: { productId: item.productId, isCritical: true },
            include: { ingredient: true },
          });
          const allOk = allCritical.every((r) => r.ingredient.currentStock > 0);
          if (allOk) {
            await this.prisma.product.update({
              where: { id: item.productId },
              data: { available: true },
            });
            affectedProducts.push(item.productId);
          }
        }
      }
    }

    return {
      ingredient: updatedIngredient,
      movement,
      affectedProducts,
    };
  }

  async getMovements(limit = 100) {
    const list = await this.prisma.stockMovement.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true, category: true },
        },
      },
    });

    return list.map((m) => ({
      id: m.id,
      ingredientId: m.ingredientId,
      ingredientName: m.ingredient?.name || "Inconnu",
      category: m.ingredient?.category || "Général",
      unit: m.ingredient?.unit || "u",
      type: m.type,
      quantity: m.quantity,
      unitCost: m.unitCost,
      orderId: m.orderId,
      staffId: m.staffId,
      reason: m.reason,
      createdAt: m.createdAt.getTime(),
    }));
  }
}
