import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
@Injectable()
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    try {
      // Send initial snapshot state to newly connected client
      const fullState = await this.getFullState();
      client.emit("sync:init", fullState);
    } catch (err) {
      this.logger.error("Error sending initial sync to client", err);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  public async getFullState() {
    const [tables, rawOrders, products, menus, roles, staff, rawHistory, rawIngredients, rawRecipes, rawMovements] = await Promise.all([
      this.prisma.table.findMany({ orderBy: { number: "asc" } }),
      this.prisma.order.findMany({
        where: { status: "open" },
        include: { items: true },
      }),
      this.prisma.product.findMany(),
      this.prisma.menu.findMany(),
      this.prisma.role.findMany(),
      this.prisma.staff.findMany({
        select: {
          id: true,
          name: true,
          roleId: true,
          pin: true,
          email: true,
          phone: true,
          active: true,
          avatarBg: true,
        },
      }),
      this.prisma.orderHistory.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.ingredient.findMany({
        orderBy: { name: "asc" },
      }),
      this.prisma.recipeItem.findMany({
        include: {
          ingredient: {
            select: { id: true, name: true, unit: true, costPerUnit: true, currentStock: true },
          },
        },
      }),
      this.prisma.stockMovement.findMany({
        take: 60,
        orderBy: { createdAt: "desc" },
        include: {
          ingredient: {
            select: { name: true, unit: true, category: true },
          },
        },
      }),
    ]);

    // Format fields with parsed JSON
    const parsedOrders = rawOrders.map((o) => ({
      id: o.id,
      tableId: o.tableId,
      server: o.server,
      createdAt: o.createdAt.getTime(),
      sentAt: o.sentAt ? o.sentAt.getTime() : null,
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        name: i.name,
        price: i.price,
        qty: i.qty,
        notes: i.notes || "",
        status: i.status,
        isMenu: i.isMenu,
        composition: i.composition ? JSON.parse(i.composition) : null,
      })),
    }));

    const parsedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      cat: p.cat,
      price: p.price,
      desc: p.desc,
      emoji: p.emoji || "🍽️",
      allergens: JSON.parse(p.allergens || "[]"),
      available: p.available,
      isMenu: p.isMenu,
    }));

    const parsedMenus = menus.map((m) => ({
      id: m.id,
      name: m.name,
      price: m.price,
      desc: m.desc,
      emoji: m.emoji || "📋",
      available: m.available,
      groups: JSON.parse(m.groups || "[]"),
    }));

    const parsedRoles = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      color: r.color,
      isSystem: r.isSystem,
      permissions: JSON.parse(r.permissions || "[]"),
    }));

    const parsedHistory = rawHistory.map((h) => ({
      id: h.id,
      orderId: h.orderId,
      tableNumber: h.tableNumber,
      server: h.server,
      items: JSON.parse(h.items || "[]"),
      total: h.total,
      paymentMethod: h.paymentMethod,
      payments: JSON.parse(h.payments || "[]"),
      createdAt: h.createdAt.getTime(),
    }));

    const parsedIngredients = rawIngredients.map((ing) => {
      const isOut = ing.currentStock <= 0;
      const isLow = !isOut && ing.currentStock <= ing.minThreshold;
      return {
        ...ing,
        status: isOut ? "out" : isLow ? "low" : "ok",
        stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
      };
    });

    const parsedRecipes = rawRecipes.map((rc) => ({
      id: rc.id,
      productId: rc.productId,
      ingredientId: rc.ingredientId,
      ingredientName: rc.ingredient?.name || "Inconnu",
      quantity: rc.quantity,
      unit: rc.unit,
      costPerUnit: rc.ingredient?.costPerUnit || 0,
      currentStock: rc.ingredient?.currentStock || 0,
      isCritical: rc.isCritical,
      notes: rc.notes || "",
    }));

    const parsedMovements = rawMovements.map((m) => ({
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

    return {
      tables,
      orders: parsedOrders,
      products: parsedProducts,
      menus: parsedMenus,
      roles: parsedRoles,
      staff,
      history: parsedHistory,
      ingredients: parsedIngredients,
      recipes: parsedRecipes,
      stockMovements: parsedMovements,
    };
  }

  // ── Handlers Socket.IO ──────────────────────────────────────────

  @SubscribeMessage("sync:request")
  async handleSyncRequest(@ConnectedSocket() _client: Socket) {
    const fullState = await this.getFullState();
    return { ok: true, state: fullState };
  }

  @SubscribeMessage("auth:verify_pin")
  async handleVerifyPin(@MessageBody() data: { pin: string }) {
    const staff = await this.prisma.staff.findFirst({
      where: { pin: data.pin, active: true },
      include: { role: true },
    });

    if (!staff) {
      return { ok: false, error: "Code PIN incorrect ou compte désactivé" };
    }

    return {
      ok: true,
      staff: {
        id: staff.id,
        name: staff.name,
        roleId: staff.roleId,
        avatarBg: staff.avatarBg,
        role: {
          ...staff.role,
          permissions: JSON.parse(staff.role.permissions || "[]"),
        },
      },
    };
  }

  @SubscribeMessage("tables:toggle_alert")
  async handleToggleAlert(@MessageBody() data: { tableId: string }) {
    const table = await this.prisma.table.findUnique({ where: { id: data.tableId } });
    if (!table) return { ok: false, error: "Table introuvable" };

    const updated = await this.prisma.table.update({
      where: { id: data.tableId },
      data: { alert: !table.alert },
    });

    this.server.emit("table:updated", updated);
    return { ok: true, table: updated };
  }

  @SubscribeMessage("order:create_or_ensure")
  async handleEnsureOrder(
    @MessageBody() data: { tableId: string; server: string; orderId?: string }
  ) {
    let table = await this.prisma.table.findUnique({ where: { id: data.tableId } });
    if (!table) {
      const num = parseInt(data.tableId.replace("tbl_", ""), 10);
      if (!isNaN(num)) {
        table = await this.prisma.table.findUnique({ where: { number: num } });
      }
    }
    if (!table) {
      table = await this.prisma.table.findFirst();
    }
    if (!table) return { ok: false, error: "Aucune table trouvée" };

    const resolvedTableId = table.id;

    let order = null;
    if (data.orderId) {
      order = await this.prisma.order.findUnique({
        where: { id: data.orderId },
        include: { items: true },
      });
    }

    if (!order) {
      order = await this.prisma.order.findFirst({
        where: { tableId: resolvedTableId, status: "open" },
        include: { items: true },
      });
    }

    if (!order) {
      order = await this.prisma.order.create({
        data: {
          id: data.orderId || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          tableId: resolvedTableId,
          server: data.server || "Service",
          status: "open",
        },
        include: { items: true },
      });
    }

    const formattedOrder = this.formatOrder(order);
    this.server.emit("order:updated", formattedOrder);
    return { ok: true, order: formattedOrder };
  }

  @SubscribeMessage("order:add_item")
  async handleAddItem(
    @MessageBody()
    data: {
      orderId: string;
      product: { id: string; name: string; price: number; isMenu?: boolean };
      composition?: any;
    }
  ) {
    let order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });

    if (!order) {
      const firstTable = await this.prisma.table.findFirst();
      if (!firstTable) return { ok: false, error: "Commande non trouvée" };
      order = await this.prisma.order.create({
        data: {
          id: data.orderId,
          tableId: firstTable.id,
          server: "Service",
          status: "open",
        },
        include: { items: true },
      });
    }

    if (!data.product.isMenu) {
      const existing = order.items.find(
        (i) => i.productId === data.product.id && i.status === "draft" && !i.notes
      );
      if (existing) {
        await this.prisma.orderItem.update({
          where: { id: existing.id },
          data: { qty: existing.qty + 1 },
        });
      } else {
        await this.prisma.orderItem.create({
          data: {
            id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            orderId: order.id,
            productId: data.product.id,
            name: data.product.name,
            price: data.product.price,
            qty: 1,
            notes: "",
            status: "draft",
            isMenu: false,
          },
        });
      }
    } else {
      await this.prisma.orderItem.create({
        data: {
          id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          orderId: order.id,
          productId: data.product.id,
          name: data.product.name,
          price: data.product.price,
          qty: 1,
          notes: "",
          status: "draft",
          isMenu: true,
          composition: data.composition ? JSON.stringify(data.composition) : null,
        },
      });
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });
    const formatted = this.formatOrder(updated);
    this.server.emit("order:updated", formatted);
    return { ok: true, order: formatted };
  }

  @SubscribeMessage("order:change_qty")
  async handleChangeQty(
    @MessageBody() data: { orderId: string; itemId: string; delta: number }
  ) {
    const item = await this.prisma.orderItem.findUnique({ where: { id: data.itemId } });
    if (!item) return { ok: false, error: "Article non trouvé" };

    const newQty = item.qty + data.delta;
    if (newQty <= 0) {
      await this.prisma.orderItem.delete({ where: { id: data.itemId } });
    } else {
      await this.prisma.orderItem.update({
        where: { id: data.itemId },
        data: { qty: newQty },
      });
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });
    const formatted = this.formatOrder(updated);
    this.server.emit("order:updated", formatted);
    return { ok: true, order: formatted };
  }

  @SubscribeMessage("order:remove_item")
  async handleRemoveItem(@MessageBody() data: { orderId: string; itemId: string }) {
    await this.prisma.orderItem.deleteMany({ where: { id: data.itemId } });
    const updated = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });
    const formatted = this.formatOrder(updated);
    this.server.emit("order:updated", formatted);
    return { ok: true, order: formatted };
  }

  @SubscribeMessage("order:set_note")
  async handleSetNote(
    @MessageBody() data: { orderId: string; itemId: string; note: string }
  ) {
    await this.prisma.orderItem.update({
      where: { id: data.itemId },
      data: { notes: data.note },
    });
    const updated = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });
    const formatted = this.formatOrder(updated);
    this.server.emit("order:updated", formatted);
    return { ok: true, order: formatted };
  }

  @SubscribeMessage("order:send_kitchen")
  async handleSendKitchen(
    @MessageBody() data: { orderId: string; serverName?: string }
  ) {
    let order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, table: true },
    });
    if (!order) {
      order = await this.prisma.order.findFirst({
        where: { status: "open" },
        include: { items: true, table: true },
      });
      if (!order) {
        return { ok: false, error: "Commande introuvable" };
      }
    }

    // ── Phase 2 : Décompte automatique des stocks pour les articles en 'draft' ──
    const draftItems = order.items.filter((i) => i.status === "draft");
    if (draftItems.length > 0) {
      const productQuantities: { productId: string; qty: number; itemName: string }[] = [];

      for (const item of draftItems) {
        if (item.isMenu && item.composition) {
          try {
            const comp = typeof item.composition === "string" ? JSON.parse(item.composition) : item.composition;
            if (Array.isArray(comp)) {
              for (const c of comp) {
                const pId = typeof c === "string" ? c : c?.id || c?.productId;
                if (pId) {
                  productQuantities.push({ productId: pId, qty: item.qty, itemName: `${item.name} (${c.name || pId})` });
                }
              }
            }
          } catch (e) {
            this.logger.error("Error parsing menu composition for stock deduction", e);
          }
        } else {
          productQuantities.push({ productId: item.productId, qty: item.qty, itemName: item.name });
        }
      }

      if (productQuantities.length > 0) {
        const productIds = productQuantities.map((p) => p.productId);
        const recipeItems = await this.prisma.recipeItem.findMany({
          where: { productId: { in: productIds } },
          include: { ingredient: true, product: true },
        });

        const deductionMap = new Map<string, { qty: number; ingredient: any; reasons: string[] }>();
        for (const pq of productQuantities) {
          const recipes = recipeItems.filter((r) => r.productId === pq.productId);
          for (const rc of recipes) {
            const totalQtyToDeduct = rc.quantity * pq.qty;
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

        if (deductionMap.size > 0) {
          const stockAlerts: string[] = [];
          const affectedProducts: string[] = [];

          await this.prisma.$transaction(async (tx) => {
            for (const [ingredientId, deduction] of deductionMap.entries()) {
              const current = deduction.ingredient;
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
                  reason: `Commande Table ${order.table?.number || "?"} : ${deduction.reasons.join(", ")}`,
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
              } else if (newStock <= current.minThreshold) {
                stockAlerts.push(`🟡 Seuil critique : ${current.name} (reste ${newStock} ${current.unit})`);
              }
            }
          });

          // Diffuser les alertes
          for (const msg of stockAlerts) {
            this.server.emit("stock:alert", { message: msg });
          }

          // Si des produits sont passés indisponibles
          if (affectedProducts.length > 0) {
            const allProducts = await this.prisma.product.findMany();
            this.server.emit("catalog:products_updated", allProducts.map((p) => ({
              ...p,
              emoji: p.emoji || "🍽️",
              allergens: JSON.parse(p.allergens || "[]"),
            })));
          }

          // Diffuser les ingrédients mis à jour
          const refreshedIngredients = await this.prisma.ingredient.findMany({ orderBy: { name: "asc" } });
          this.server.emit("stock:updated", refreshedIngredients.map((ing) => ({
            ...ing,
            status: ing.currentStock <= 0 ? "out" : ing.currentStock <= ing.minThreshold ? "low" : "ok",
            stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
          })));

          // Diffuser les derniers mouvements
          const recentMovements = await this.prisma.stockMovement.findMany({
            take: 60,
            orderBy: { createdAt: "desc" },
            include: { ingredient: { select: { name: true, unit: true, category: true } } },
          });
          this.server.emit("stock:movements_updated", recentMovements.map((m) => ({
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
          })));
        }
      }
    }

    const now = new Date();
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        sentAt: now,
        server: data.serverName ? data.serverName : undefined,
      },
    });

    await this.prisma.orderItem.updateMany({
      where: { orderId: order.id, status: "draft" },
      data: { status: "new" },
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, table: true },
    });
    const formatted = this.formatOrder(updated);

    this.server.emit("order:updated", formatted);
    this.server.emit("kitchen:new_ticket", {
      orderId: updated.id,
      tableNumber: updated.table?.number,
      server: updated.server,
    });
    return { ok: true, order: formatted };
  }

  @SubscribeMessage("order:start_prep")
  async handleStartPrep(@MessageBody() data: { orderId: string }) {
    const existing = await this.prisma.order.findUnique({ where: { id: data.orderId } });
    if (!existing) return { ok: false, error: "Commande introuvable" };

    await this.prisma.orderItem.updateMany({
      where: { orderId: data.orderId, status: "new" },
      data: { status: "preparing" },
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });
    const formatted = this.formatOrder(updated);
    this.server.emit("order:updated", formatted);
    return { ok: true, order: formatted };
  }

  @SubscribeMessage("order:mark_ready")
  async handleMarkReady(@MessageBody() data: { orderId: string }) {
    const existing = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, table: true },
    });
    if (!existing) return { ok: false, error: "Commande introuvable" };

    await this.prisma.orderItem.updateMany({
      where: { orderId: data.orderId, status: "preparing" },
      data: { status: "ready" },
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, table: true },
    });
    const formatted = this.formatOrder(updated);

    this.server.emit("order:updated", formatted);
    this.server.emit("server:order_ready", {
      orderId: updated.id,
      tableNumber: updated.table?.number,
    });
    return { ok: true, order: formatted };
  }

  @SubscribeMessage("order:serve")
  async handleServe(@MessageBody() data: { orderId: string }) {
    const existing = await this.prisma.order.findUnique({ where: { id: data.orderId } });
    if (!existing) return { ok: false, error: "Commande introuvable" };

    await this.prisma.orderItem.updateMany({
      where: { orderId: data.orderId, status: "ready" },
      data: { status: "served" },
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });
    const formatted = this.formatOrder(updated);
    this.server.emit("order:updated", formatted);
    return { ok: true, order: formatted };
  }

  @SubscribeMessage("order:checkout")
  async handleCheckout(
    @MessageBody()
    data: {
      orderId: string;
      paymentMethod: string;
      payments?: any[];
      serverName?: string;
    }
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, table: true },
    });
    if (!order) return { ok: false, error: "Commande introuvable" };

    const paidItems = order.items.filter((i) => i.status !== "draft");
    const total = paidItems.reduce((s, i) => s + i.price * i.qty, 0);
    const paidAt = new Date();

    const paymentList =
      data.payments && data.payments.length > 0
        ? data.payments
        : [
            {
              id: `pay_${Date.now()}`,
              label: "Paiement unique",
              amount: total,
              method: data.paymentMethod || "carte",
              paidAt: paidAt.getTime(),
            },
          ];

    const finalMethod =
      data.paymentMethod || (paymentList.length > 1 ? "partage" : paymentList[0]?.method || "carte");

    // Create history snapshot
    const historyRecord = await this.prisma.orderHistory.create({
      data: {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        orderId: order.id,
        tableNumber: order.table?.number,
        server: data.serverName || order.server,
        items: JSON.stringify(paidItems),
        total,
        paymentMethod: finalMethod,
        payments: JSON.stringify(paymentList),
        createdAt: paidAt,
      },
    });

    // Close order
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: "closed" },
    });

    // Reset table reservation & alert
    const updatedTable = await this.prisma.table.update({
      where: { id: order.tableId },
      data: {
        alert: false,
        reserved: false,
        reservationName: null,
        reservationPeople: null,
        reservationTime: null,
        reservationNote: null,
      },
    });

    const parsedHistory = {
      id: historyRecord.id,
      orderId: historyRecord.orderId,
      tableNumber: historyRecord.tableNumber,
      server: historyRecord.server,
      items: paidItems,
      total: historyRecord.total,
      paymentMethod: historyRecord.paymentMethod,
      payments: paymentList,
      createdAt: paidAt.getTime(),
    };

    this.server.emit("order:closed", { orderId: order.id });
    this.server.emit("table:updated", updatedTable);
    this.server.emit("history:new_entry", parsedHistory);

    return { ok: true, history: parsedHistory, table: updatedTable };
  }

  // ── Handlers Phase 2 : Stocks & Fiches Techniques ─────────────

  @SubscribeMessage("stock:request_sync")
  async handleStockRequestSync() {
    const [ingredients, recipes, movements] = await Promise.all([
      this.prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
      this.prisma.recipeItem.findMany({
        include: {
          ingredient: {
            select: { id: true, name: true, unit: true, costPerUnit: true, currentStock: true },
          },
        },
      }),
      this.prisma.stockMovement.findMany({
        take: 60,
        orderBy: { createdAt: "desc" },
        include: { ingredient: { select: { name: true, unit: true, category: true } } },
      }),
    ]);

    return {
      ok: true,
      ingredients: ingredients.map((ing) => ({
        ...ing,
        status: ing.currentStock <= 0 ? "out" : ing.currentStock <= ing.minThreshold ? "low" : "ok",
        stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
      })),
      recipes: recipes.map((rc) => ({
        id: rc.id,
        productId: rc.productId,
        ingredientId: rc.ingredientId,
        ingredientName: rc.ingredient?.name || "Inconnu",
        quantity: rc.quantity,
        unit: rc.unit,
        costPerUnit: rc.ingredient?.costPerUnit || 0,
        currentStock: rc.ingredient?.currentStock || 0,
        isCritical: rc.isCritical,
        notes: rc.notes || "",
      })),
      movements: movements.map((m) => ({
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

  @SubscribeMessage("stock:add_movement")
  async handleAddMovement(
    @MessageBody()
    data: {
      ingredientId: string;
      type: "DELIVERY" | "WASTE" | "ADJUSTMENT";
      quantity: number;
      unitCost?: number;
      reason?: string;
      staffId?: string;
    }
  ) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: data.ingredientId },
      include: { recipeItems: { include: { product: true } } },
    });
    if (!ingredient) return { ok: false, error: "Ingrédient introuvable" };

    const newStock = Math.max(0, ingredient.currentStock + Number(data.quantity));
    const movementId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const [updatedIngredient] = await this.prisma.$transaction([
      this.prisma.ingredient.update({
        where: { id: data.ingredientId },
        data: {
          currentStock: newStock,
          costPerUnit: data.unitCost !== undefined && data.unitCost > 0 ? Number(data.unitCost) : ingredient.costPerUnit,
        },
      }),
      this.prisma.stockMovement.create({
        data: {
          id: movementId,
          ingredientId: data.ingredientId,
          type: data.type,
          quantity: Number(data.quantity),
          unitCost: data.unitCost ?? ingredient.costPerUnit,
          staffId: data.staffId || null,
          reason: data.reason || null,
        },
      }),
    ]);

    // Rupture en cascade ou réactivation
    let availabilityChanged = false;
    if (newStock <= 0) {
      for (const item of ingredient.recipeItems) {
        if (item.isCritical && item.product.available) {
          await this.prisma.product.update({
            where: { id: item.productId },
            data: { available: false },
          });
          availabilityChanged = true;
        }
      }
    } else if (ingredient.currentStock <= 0 && newStock > 0) {
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
            availabilityChanged = true;
          }
        }
      }
    }

    if (availabilityChanged) {
      const allProducts = await this.prisma.product.findMany();
      this.server.emit("catalog:products_updated", allProducts.map((p) => ({
        ...p,
        emoji: p.emoji || "🍽️",
        allergens: JSON.parse(p.allergens || "[]"),
      })));
    }

    const allIngredients = await this.prisma.ingredient.findMany({ orderBy: { name: "asc" } });
    this.server.emit("stock:updated", allIngredients.map((ing) => ({
      ...ing,
      status: ing.currentStock <= 0 ? "out" : ing.currentStock <= ing.minThreshold ? "low" : "ok",
      stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
    })));

    const recentMovements = await this.prisma.stockMovement.findMany({
      take: 60,
      orderBy: { createdAt: "desc" },
      include: { ingredient: { select: { name: true, unit: true, category: true } } },
    });
    this.server.emit("stock:movements_updated", recentMovements.map((m) => ({
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
    })));

    return { ok: true, ingredient: updatedIngredient };
  }

  @SubscribeMessage("stock:create_ingredient")
  async handleCreateIngredient(@MessageBody() data: any) {
    const id = data.id || `ing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const created = await this.prisma.ingredient.create({
      data: {
        id,
        name: data.name,
        category: data.category || "Épicerie",
        unit: data.unit || "piece",
        currentStock: Number(data.currentStock) || 0,
        minThreshold: Number(data.minThreshold) || 5,
        idealStock: Number(data.idealStock) || 20,
        costPerUnit: Number(data.costPerUnit) || 0,
        supplier: data.supplier || null,
        supplierRef: data.supplierRef || null,
      },
    });

    if (Number(data.currentStock) > 0) {
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

    const allIngredients = await this.prisma.ingredient.findMany({ orderBy: { name: "asc" } });
    this.server.emit("stock:updated", allIngredients.map((ing) => ({
      ...ing,
      status: ing.currentStock <= 0 ? "out" : ing.currentStock <= ing.minThreshold ? "low" : "ok",
      stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
    })));

    return { ok: true, ingredient: created };
  }

  @SubscribeMessage("stock:update_ingredient")
  async handleUpdateIngredient(
    @MessageBody() data: { id: string; [key: string]: any }
  ) {
    const existing = await this.prisma.ingredient.findUnique({ where: { id: data.id } });
    if (!existing) return { ok: false, error: "Ingrédient introuvable" };

    const updated = await this.prisma.ingredient.update({
      where: { id: data.id },
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

    const allIngredients = await this.prisma.ingredient.findMany({ orderBy: { name: "asc" } });
    this.server.emit("stock:updated", allIngredients.map((ing) => ({
      ...ing,
      status: ing.currentStock <= 0 ? "out" : ing.currentStock <= ing.minThreshold ? "low" : "ok",
      stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
    })));

    return { ok: true, ingredient: updated };
  }

  @SubscribeMessage("stock:delete_ingredient")
  async handleDeleteIngredient(@MessageBody() data: { id: string }) {
    const usage = await this.prisma.recipeItem.count({ where: { ingredientId: data.id } });
    if (usage > 0) {
      return { ok: false, error: "Cet ingrédient est utilisé dans une ou plusieurs fiches techniques" };
    }

    await this.prisma.stockMovement.deleteMany({ where: { ingredientId: data.id } });
    await this.prisma.ingredient.delete({ where: { id: data.id } });

    const allIngredients = await this.prisma.ingredient.findMany({ orderBy: { name: "asc" } });
    this.server.emit("stock:updated", allIngredients.map((ing) => ({
      ...ing,
      status: ing.currentStock <= 0 ? "out" : ing.currentStock <= ing.minThreshold ? "low" : "ok",
      stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
    })));

    return { ok: true };
  }

  @SubscribeMessage("recipe:save")
  async handleSaveRecipe(
    @MessageBody() data: { productId: string; items: any[] }
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) return { ok: false, error: "Produit introuvable" };

    await this.prisma.$transaction(async (tx) => {
      await tx.recipeItem.deleteMany({ where: { productId: data.productId } });
      for (const item of data.items || []) {
        if (!item.ingredientId || Number(item.quantity) <= 0) continue;
        await tx.recipeItem.create({
          data: {
            id: `rc_${data.productId}_${item.ingredientId}`,
            productId: data.productId,
            ingredientId: item.ingredientId,
            quantity: Number(item.quantity),
            unit: item.unit,
            isCritical: item.isCritical ?? true,
            notes: item.notes || null,
          },
        });
      }
    });

    const allRecipes = await this.prisma.recipeItem.findMany({
      include: {
        ingredient: {
          select: { id: true, name: true, unit: true, costPerUnit: true, currentStock: true },
        },
      },
    });

    const parsedRecipes = allRecipes.map((rc) => ({
      id: rc.id,
      productId: rc.productId,
      ingredientId: rc.ingredientId,
      ingredientName: rc.ingredient?.name || "Inconnu",
      quantity: rc.quantity,
      unit: rc.unit,
      costPerUnit: rc.ingredient?.costPerUnit || 0,
      currentStock: rc.ingredient?.currentStock || 0,
      isCritical: rc.isCritical,
      notes: rc.notes || "",
    }));

    this.server.emit("recipes:updated", parsedRecipes);
    return { ok: true, recipes: parsedRecipes };
  }

  @SubscribeMessage("catalog:toggle_product_available")
  async handleToggleProductAvailable(@MessageBody() data: { productId: string; available?: boolean }) {
    const product = await this.prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) return { ok: false, error: "Produit introuvable" };

    const newAvailable = data.available !== undefined ? data.available : !product.available;
    const updated = await this.prisma.product.update({
      where: { id: data.productId },
      data: { available: newAvailable },
    });

    const allProducts = await this.prisma.product.findMany();
    this.server.emit("catalog:products_updated", allProducts.map((p) => ({
      ...p,
      emoji: p.emoji || "🍽️",
      allergens: JSON.parse(p.allergens || "[]"),
    })));

    return { ok: true, product: updated };
  }

  // Helper
  private formatOrder(order: any) {
    if (!order) return null;
    return {
      id: order.id,
      tableId: order.tableId,
      server: order.server,
      createdAt: order.createdAt instanceof Date ? order.createdAt.getTime() : order.createdAt,
      sentAt: order.sentAt ? (order.sentAt instanceof Date ? order.sentAt.getTime() : order.sentAt) : null,
      items: order.items.map((i: any) => ({
        id: i.id,
        productId: i.productId,
        name: i.name,
        price: i.price,
        qty: i.qty,
        notes: i.notes || "",
        status: i.status,
        isMenu: i.isMenu,
        composition: i.composition ? (typeof i.composition === "string" ? JSON.parse(i.composition) : i.composition) : null,
      })),
    };
  }
}
