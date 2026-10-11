import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { orderLabel } from "../orders/orders.service";
import { toStockQty } from "../recipes/units";

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
      currentStock?: number;
      minThreshold?: number;
      idealStock?: number;
      costPerUnit?: number;
      supplier?: string;
      supplierRef?: string;
    }
  ) {
    const existing = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Ingrédient introuvable : ${id}`);

    if (data.currentStock !== undefined && Number(data.currentStock) !== existing.currentStock) {
      const delta = Number(data.currentStock) - existing.currentStock;
      await this.prisma.stockMovement.create({
        data: {
          id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ingredientId: id,
          type: "ADJUSTMENT",
          quantity: delta,
          unitCost: data.costPerUnit !== undefined ? Number(data.costPerUnit) : existing.costPerUnit,
          reason: "Ajustement d'inventaire",
        },
      });
    }

    return this.prisma.ingredient.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        category: data.category ?? existing.category,
        unit: data.unit ?? existing.unit,
        currentStock: data.currentStock !== undefined ? Number(data.currentStock) : existing.currentStock,
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
    // Soft-delete : archivage pour préserver l'historique et la traçabilité des mouvements
    return this.prisma.ingredient.update({
      where: { id },
      data: { archived: true },
    });
  }

  async restoreIngredient(id: string) {
    return this.prisma.ingredient.update({
      where: { id },
      data: { archived: false },
    });
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

      // Cascade to menus: disable any menu containing a now-unavailable product
      if (affectedProducts.length > 0) {
        const menusRaw = await this.prisma.menu.findMany();
        for (const menu of menusRaw) {
          try {
            const groups = JSON.parse(menu.groups || '[]');
            const menuProductIds = groups.flatMap((g: any) =>
              (g.choices || g.options || []).map((c: any) => c.id || c.productId).filter(Boolean)
            );
            const hasDisabledProduct = menuProductIds.some((pid: string) => affectedProducts.includes(pid));
            if (hasDisabledProduct && menu.available) {
              await this.prisma.menu.update({
                where: { id: menu.id },
                data: { available: false },
              });
            }
          } catch {}
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

  /** Besoins en ingrédients d'une liste d'articles (menus composés éclatés par composant) */
  private async ingredientNeeds(items: { productId: string; name: string; qty: number; isMenu: boolean; composition: string | null }[]) {
    const deductionMap = new Map<string, { qty: number; ingredient: any; reasons: string[] }>();
    const productQuantities: { productId: string; qty: number; itemName: string }[] = [];

    for (const item of items) {
      if (item.isMenu && item.composition) {
        try {
          const comp = typeof item.composition === "string" ? JSON.parse(item.composition) : item.composition;
          if (Array.isArray(comp)) {
            for (const c of comp) {
              // Groupe de menu composé : { title, names, productIds }
              if (Array.isArray(c?.productIds)) {
                c.productIds.forEach((pId: string, idx: number) => {
                  productQuantities.push({
                    productId: pId,
                    qty: item.qty,
                    itemName: `${item.name} (${c.names?.[idx] || pId})`,
                  });
                });
                continue;
              }
              const pId = typeof c === "string" ? c : c?.id || c?.productId;
              if (pId) {
                productQuantities.push({ productId: pId, qty: item.qty, itemName: `${item.name} (${c.name || pId})` });
              }
            }
          }
        } catch {
          // ignore parsing error
        }
      } else {
        productQuantities.push({ productId: item.productId, qty: item.qty, itemName: item.name });
      }
    }

    if (productQuantities.length === 0) return deductionMap;

    const productIds = productQuantities.map((p) => p.productId);
    const recipeItems = await this.prisma.recipeItem.findMany({
      where: { productId: { in: productIds } },
      include: { ingredient: true, product: true },
    });

    for (const pq of productQuantities) {
      const recipes = recipeItems.filter((r) => r.productId === pq.productId);
      for (const rc of recipes) {
        // Dosage converti dans l'unité du stock (ex. 150 g pour un stock en kg)
        const totalQtyToDeduct = toStockQty(rc.quantity, rc.unit, rc.ingredient.unit) * pq.qty;
        const existing = deductionMap.get(rc.ingredientId) || {
          qty: 0,
          ingredient: rc.ingredient,
          reasons: [],
        };
        existing.qty += totalQtyToDeduct;
        existing.reasons.push(`${pq.itemName} x${pq.qty}`);
        deductionMap.set(rc.ingredientId, existing);
      }
    }
    return deductionMap;
  }

  // itemIds : lignes déjà vendues à déstocker (vente comptoir) ; par défaut, les brouillons partant en cuisine
  async deductForOrder(orderId: string, itemIds?: string[]) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    if (!order) return null;

    const draftItems = order.items.filter((i) => (itemIds ? itemIds.includes(i.id) : i.status === "draft"));
    if (draftItems.length === 0) return null;

    const deductionMap = await this.ingredientNeeds(draftItems);
    if (deductionMap.size === 0) return null;

    const stockAlerts: string[] = [];
    const affectedProducts: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const [ingredientId, deduction] of deductionMap.entries()) {
        const current = await tx.ingredient.findUnique({ where: { id: ingredientId } });
        if (!current) continue;

        const newStock = Math.max(0, current.currentStock - deduction.qty);

        await tx.ingredient.update({
          where: { id: ingredientId },
          data: { currentStock: newStock },
        });

        await tx.stockMovement.create({
          data: {
            id: `mov_ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ingredientId,
            type: "ORDER_CONSUMPTION",
            quantity: -deduction.qty,
            unitCost: current.costPerUnit,
            orderId: order.id,
            staffId: order.serverId || null,
            reason: `Commande ${orderLabel(order)} : ${deduction.reasons.join(", ")}`,
          },
        });

        if (newStock <= 0) {
          stockAlerts.push(`🔴 Rupture de stock : ${current.name} (épuisé)`);
          const criticalRecipes = await tx.recipeItem.findMany({
            where: { ingredientId, isCritical: true },
          });
          for (const cr of criticalRecipes) {
            await tx.product.update({
              where: { id: cr.productId },
              data: { available: false },
            });
            affectedProducts.push(cr.productId);
          }

          if (affectedProducts.length > 0) {
            const menusRaw = await tx.menu.findMany();
            for (const menu of menusRaw) {
              try {
                const groups = JSON.parse(menu.groups || '[]');
                const menuProductIds = groups.flatMap((g: any) =>
                  (g.choices || g.options || []).map((c: any) => c.id || c.productId).filter(Boolean)
                );
                const hasDisabledProduct = menuProductIds.some((pid: string) => affectedProducts.includes(pid));
                if (hasDisabledProduct && menu.available) {
                  await tx.menu.update({
                    where: { id: menu.id },
                    data: { available: false },
                  });
                }
              } catch {}
            }
          }
        } else if (newStock <= current.minThreshold) {
          stockAlerts.push(`🟡 Seuil critique : ${current.name} (reste ${newStock} ${current.unit})`);
        }
      }
    });

    const refreshedIngredients = await this.prisma.ingredient.findMany({ orderBy: { name: "asc" } });
    const recentMovements = await this.prisma.stockMovement.findMany({
      take: 60,
      orderBy: { createdAt: "desc" },
      include: { ingredient: { select: { name: true, unit: true, category: true } } },
    });

    return {
      stockAlerts,
      affectedProducts,
      refreshedIngredients: refreshedIngredients.map((ing) => ({
        ...ing,
        status: ing.currentStock <= 0 ? "out" : ing.currentStock <= ing.minThreshold ? "low" : "ok",
        stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
      })),
      recentMovements: recentMovements.map((m) => ({
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
      })),
    };
  }

  /**
   * Réintègre les ingrédients d'un article annulé avant sa préparation.
   * Retourne false si le produit n'a pas de fiche technique (rien à réintégrer).
   */
  async returnForVoid(
    item: { productId: string; name: string; qty: number; isMenu: boolean; composition: string | null },
    qty: number,
    orderId: string,
    label: string,
    staffId: string | null,
    reason: string
  ) {
    const needs = await this.ingredientNeeds([{ ...item, qty }]);
    if (needs.size === 0) return false;

    await this.prisma.$transaction(async (tx) => {
      for (const [ingredientId, need] of needs.entries()) {
        const current = await tx.ingredient.findUnique({ where: { id: ingredientId } });
        if (!current) continue;
        await tx.ingredient.update({
          where: { id: ingredientId },
          data: { currentStock: current.currentStock + need.qty },
        });
        await tx.stockMovement.create({
          data: {
            id: `mov_void_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ingredientId,
            type: "CANCEL_RETURN",
            quantity: need.qty,
            unitCost: current.costPerUnit,
            orderId,
            staffId,
            reason: `Annulation ${label} : ${need.reasons.join(", ")} (${reason})`,
          },
        });
      }
    });
    return true;
  }
}
