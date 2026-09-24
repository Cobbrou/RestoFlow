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
    const [tables, rawOrders, products, menus, roles, staff, rawHistory, rawIngredients, rawRecipes, rawMovements, rawConfig, rawReservations] = await Promise.all([
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
      this.prisma.restaurantConfig.findUnique({ where: { id: "default" } }),
      this.prisma.reservation.findMany({
        orderBy: [{ date: "asc" }, { time: "asc" }],
      }),
    ]);

    // Format fields with parsed JSON
    const parsedOrders = rawOrders.map((o) => ({
      id: o.id,
      tableId: o.tableId,
      server: o.server,
      createdAt: o.createdAt.getTime(),
      sentAt: o.sentAt ? o.sentAt.getTime() : null,
      discount: o.discount ? JSON.parse(o.discount) : null,
      items: o.items.map((i: any) => ({
        id: i.id,
        productId: i.productId,
        name: i.name,
        price: i.price,
        qty: i.qty,
        notes: i.notes || "",
        status: i.status,
        isMenu: i.isMenu,
        composition: i.composition ? JSON.parse(i.composition) : null,
        course: i.course || "direct",
        courseStatus: i.courseStatus || "direct",
        station: i.station || (i.productId?.startsWith("p18") || i.productId?.startsWith("p19") || i.productId?.startsWith("p20") || i.productId?.startsWith("p21") ? "bar" : "kitchen"),
      })),
    }));

    const parsedProducts = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      cat: p.cat,
      price: p.price,
      desc: p.desc,
      emoji: p.emoji || "🍽️",
      allergens: JSON.parse(p.allergens || "[]"),
      available: p.available,
      isMenu: p.isMenu,
      vatRate: p.vatRate ?? 10,
      station: p.station || (p.cat === "boissons" ? "bar" : "kitchen"),
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
      ticketNumber: h.ticketNumber || `FAC-2026-${String(h.id).slice(-4).toUpperCase()}`,
      tableNumber: h.tableNumber,
      server: h.server,
      items: JSON.parse(h.items || "[]"),
      total: h.total,
      subtotal: h.subtotal ?? h.total,
      discount: h.discount ? JSON.parse(h.discount) : null,
      vatDetails: h.vatDetails ? JSON.parse(h.vatDetails) : null,
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

    const parsedConfig = rawConfig
      ? {
          ...rawConfig,
          printers: JSON.parse(rawConfig.printers || "[]"),
          promoCodes: JSON.parse(rawConfig.promoCodes || "[]"),
        }
      : {
          id: "default",
          name: "RestoFlow Bistrot",
          legalName: "RESTOFLOW BISTROT SAS",
          siret: "987 654 321 00012",
          vatNumber: "FR 12 987654321",
          address: "14 Rue de la Paix",
          city: "75002 Paris",
          phone: "01 42 68 55 00",
          email: "contact@restoflow-bistrot.fr",
          website: "www.restoflow.fr",
          footerNote: "Merci de votre visite ! Service & taxes compris.",
          currency: "EUR",
          tpeAutoPrint: true,
          printers: [
            { id: "prn_caisse", name: "Imprimante Caisse", type: "caisse", width: "80mm", status: "online", autoCut: true, openDrawer: true },
            { id: "prn_cuisine", name: "Imprimante Cuisine", type: "cuisine", width: "80mm", status: "online", autoCut: true, beep: true },
            { id: "prn_bar", name: "Imprimante Bar", type: "bar", width: "58mm", status: "online", autoCut: true, beep: false },
          ],
          promoCodes: [
            { code: "HAPPYHOUR", label: "Happy Hour (-15%)", type: "percent", value: 15, active: true },
            { code: "STAFF", label: "Tarif Équipe (-20%)", type: "percent", value: 20, active: true },
            { code: "BIENVENUE5", label: "Offre Bienvenue (-5€)", type: "fixed", value: 5, active: true },
            { code: "FIDELITE10", label: "Remise Fidélité (-10%)", type: "percent", value: 10, active: true },
            { code: "VIP25", label: "Client Privilège (-25%)", type: "percent", value: 25, active: true },
          ],
        };

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
      config: parsedConfig,
      reservations: rawReservations,
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

  // ── Handlers Phase 4 : Salle Dynamique (Transfert & Fusion de Tables) ──

  @SubscribeMessage("tables:transfer")
  async handleTableTransfer(
    @MessageBody() data: { sourceTableId: string; targetTableId: string; staffName?: string }
  ) {
    const sourceTable = await this.prisma.table.findUnique({ where: { id: data.sourceTableId } });
    const targetTable = await this.prisma.table.findUnique({ where: { id: data.targetTableId } });

    if (!sourceTable || !targetTable) {
      return { ok: false, error: "Table source ou cible introuvable" };
    }

    const order = await this.prisma.order.findFirst({
      where: { tableId: data.sourceTableId, status: "open" },
      include: { items: true },
    });
    if (!order) {
      return { ok: false, error: "Aucune commande ouverte sur la table source" };
    }

    const existingTargetOrder = await this.prisma.order.findFirst({
      where: { tableId: data.targetTableId, status: "open" },
    });
    if (existingTargetOrder) {
      return { ok: false, error: `La table ${targetTable.number} est déjà occupée. Utilisez la fusion.` };
    }

    // Reassign order to target table
    await this.prisma.order.update({
      where: { id: order.id },
      data: { tableId: data.targetTableId },
    });

    // Clear alert/reservation flags on source table if necessary
    const updatedSource = await this.prisma.table.update({
      where: { id: data.sourceTableId },
      data: { alert: false },
    });
    const updatedTarget = await this.prisma.table.findUnique({ where: { id: data.targetTableId } });

    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });
    const formattedOrder = this.formatOrder(updatedOrder);

    this.server.emit("table:updated", updatedSource);
    this.server.emit("table:updated", updatedTarget);
    this.server.emit("order:updated", formattedOrder);
    this.server.emit("tables:transferred", {
      sourceTableNumber: sourceTable.number,
      targetTableNumber: targetTable.number,
      server: data.staffName || order.server,
    });

    return { ok: true, order: formattedOrder };
  }

  @SubscribeMessage("tables:merge")
  async handleTableMerge(
    @MessageBody() data: { sourceTableId: string; targetTableId: string; staffName?: string }
  ) {
    const sourceTable = await this.prisma.table.findUnique({ where: { id: data.sourceTableId } });
    const targetTable = await this.prisma.table.findUnique({ where: { id: data.targetTableId } });

    if (!sourceTable || !targetTable) {
      return { ok: false, error: "Table source ou cible introuvable" };
    }

    const sourceOrder = await this.prisma.order.findFirst({
      where: { tableId: data.sourceTableId, status: "open" },
      include: { items: true },
    });
    const targetOrder = await this.prisma.order.findFirst({
      where: { tableId: data.targetTableId, status: "open" },
      include: { items: true },
    });

    if (!sourceOrder || !targetOrder) {
      return { ok: false, error: "Les deux tables doivent avoir une commande ouverte pour être fusionnées" };
    }

    // Transfer items from source to target
    await this.prisma.orderItem.updateMany({
      where: { orderId: sourceOrder.id },
      data: { orderId: targetOrder.id },
    });

    // Close source order
    await this.prisma.order.update({
      where: { id: sourceOrder.id },
      data: { status: "closed" },
    });

    // Clear alert on source table
    const updatedSource = await this.prisma.table.update({
      where: { id: data.sourceTableId },
      data: { alert: false },
    });

    const updatedTargetOrder = await this.prisma.order.findUnique({
      where: { id: targetOrder.id },
      include: { items: true },
    });
    const formattedTargetOrder = this.formatOrder(updatedTargetOrder);

    this.server.emit("order:closed", { orderId: sourceOrder.id });
    this.server.emit("order:updated", formattedTargetOrder);
    this.server.emit("table:updated", updatedSource);
    this.server.emit("table:updated", targetTable);
    this.server.emit("tables:merged", {
      sourceTableNumber: sourceTable.number,
      targetTableNumber: targetTable.number,
      server: data.staffName || targetOrder.server,
    });

    return { ok: true, order: formattedTargetOrder };
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
      product: { id: string; name: string; price: number; isMenu?: boolean; cat?: string; station?: string };
      composition?: any;
      course?: string;
      courseStatus?: string;
      station?: string;
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

    let dbProduct: any = null;
    if (data.product?.id) {
      dbProduct = await this.prisma.product.findUnique({
        where: { id: data.product.id },
      });
    }

    const cat = data.product?.cat || dbProduct?.cat || "";
    const isBar =
      cat === "boissons" ||
      data.product?.station === "bar" ||
      dbProduct?.station === "bar" ||
      data.station === "bar" ||
      data.product?.id?.startsWith("p18") ||
      data.product?.id?.startsWith("p19") ||
      data.product?.id?.startsWith("p20") ||
      data.product?.id?.startsWith("p21");
    const station = isBar ? "bar" : (data.station || data.product?.station || dbProduct?.station || "kitchen");
    let course = data.course;
    if (!course) {
      if (isBar) course = "boisson";
      else if (cat === "entrees") course = "entree";
      else if (cat === "desserts") course = "dessert";
      else course = "plat";
    }
    const courseStatus = data.courseStatus || (course === "entree" || course === "boisson" || course === "direct" ? "direct" : "held");

    if (!data.product.isMenu) {
      const existing = order.items.find(
        (i: any) => i.productId === data.product.id && i.status === "draft" && !i.notes && (i.course || "direct") === course
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
            course,
            courseStatus,
            station,
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
          course: data.course || "plat",
          courseStatus: data.courseStatus || "held",
          station: "kitchen",
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
  async handleStartPrep(@MessageBody() data: { orderId: string; station?: string }) {
    const existing = await this.prisma.order.findUnique({ where: { id: data.orderId } });
    if (!existing) return { ok: false, error: "Commande introuvable" };

    const whereClause: any = { orderId: data.orderId, status: "new", courseStatus: { not: "held" } };
    if (data.station && data.station !== "all") {
      whereClause.station = data.station;
    }

    await this.prisma.orderItem.updateMany({
      where: whereClause,
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
  async handleMarkReady(@MessageBody() data: { orderId: string; station?: string }) {
    const existing = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, table: true },
    });
    if (!existing) return { ok: false, error: "Commande introuvable" };

    const whereClause: any = { orderId: data.orderId, status: "preparing", courseStatus: { not: "held" } };
    if (data.station && data.station !== "all") {
      whereClause.station = data.station;
    }

    await this.prisma.orderItem.updateMany({
      where: whereClause,
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
      station: data.station || "all",
    });
    return { ok: true, order: formatted };
  }

  @SubscribeMessage("order:serve")
  async handleServe(@MessageBody() data: { orderId: string; course?: string }) {
    const existing = await this.prisma.order.findUnique({ where: { id: data.orderId } });
    if (!existing) return { ok: false, error: "Commande introuvable" };

    const whereClause: any = { orderId: data.orderId, status: "ready" };
    if (data.course) {
      whereClause.course = data.course;
    }

    await this.prisma.orderItem.updateMany({
      where: whereClause,
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

  // ── Handlers Phase 4 : Suites & Réclame (Envoi Cadencé en Cuisine) ──

  @SubscribeMessage("order:call_course")
  async handleCallCourse(
    @MessageBody() data: { orderId: string; course: string; serverName?: string }
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, table: true },
    });
    if (!order) return { ok: false, error: "Commande introuvable" };

    const heldItems = order.items.filter(
      (i: any) =>
        (data.course === "suite" || i.course === data.course) &&
        i.courseStatus === "held"
    );

    if (heldItems.length > 0) {
      await this.prisma.orderItem.updateMany({
        where: {
          id: { in: heldItems.map((i) => i.id) },
        },
        data: {
          courseStatus: "called",
          status: "new",
        },
      });
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, table: true },
    });
    const formatted = this.formatOrder(updated);
    this.server.emit("order:updated", formatted);

    const courseLabel = data.course === "plat" ? "Plats" : data.course === "dessert" ? "Desserts" : data.course === "suite" ? "Suite" : data.course;
    this.server.emit("kitchen:call_course", {
      orderId: order.id,
      tableNumber: order.table?.number || "?",
      course: data.course,
      courseLabel,
      server: data.serverName || order.server,
      itemCount: heldItems.length,
      timestamp: Date.now(),
    });

    return { ok: true, order: formatted, calledCount: heldItems.length };
  }

  @SubscribeMessage("order:change_item_course")
  async handleChangeItemCourse(
    @MessageBody() data: { itemId: string; course: string; courseStatus?: string }
  ) {
    const item = await this.prisma.orderItem.findUnique({ where: { id: data.itemId } });
    if (!item) return { ok: false, error: "Article introuvable" };

    await this.prisma.orderItem.update({
      where: { id: data.itemId },
      data: {
        course: data.course,
        courseStatus: data.courseStatus || (data.course === "entree" || data.course === "boisson" || data.course === "direct" ? "direct" : "held"),
      },
    });

    const order = await this.prisma.order.findUnique({
      where: { id: item.orderId },
      include: { items: true },
    });
    const formatted = this.formatOrder(order);
    this.server.emit("order:updated", formatted);
    return { ok: true, order: formatted };
  }

  // ── Handlers Phase 4 : Réservations & Créneaux ──────────────────

  @SubscribeMessage("reservation:create")
  async handleCreateReservation(@MessageBody() data: any) {
    const res = await this.prisma.reservation.create({
      data: {
        id: data.id || `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        customerName: data.customerName,
        phone: data.phone,
        email: data.email || null,
        date: data.date,
        time: data.time,
        guests: data.guests || 2,
        status: data.status || "confirmed",
        tableId: data.tableId || null,
        notes: data.notes || null,
      },
      include: { table: true },
    });

    if (res.tableId) {
      const updatedTable = await this.prisma.table.update({
        where: { id: res.tableId },
        data: {
          reserved: true,
          reservationName: res.customerName,
          reservationPeople: res.guests,
          reservationTime: res.time,
          reservationNote: res.notes,
        },
      });
      this.server.emit("table:updated", updatedTable);
    }

    this.server.emit("reservation:created", res);
    return { ok: true, reservation: res };
  }

  @SubscribeMessage("reservation:update_status")
  async handleUpdateReservationStatus(
    @MessageBody() data: { id: string; status: string; tableId?: string }
  ) {
    const res = await this.prisma.reservation.findUnique({ where: { id: data.id } });
    if (!res) return { ok: false, error: "Réservation introuvable" };

    const updated = await this.prisma.reservation.update({
      where: { id: data.id },
      data: {
        status: data.status,
        tableId: data.tableId !== undefined ? data.tableId : res.tableId,
      },
      include: { table: true },
    });

    if (updated.tableId) {
      if (data.status === "seated") {
        const tbl = await this.prisma.table.findUnique({ where: { id: updated.tableId } });
        if (tbl) this.server.emit("table:updated", tbl);
      } else if (data.status === "cancelled" || data.status === "no_show") {
        const updatedTable = await this.prisma.table.update({
          where: { id: updated.tableId },
          data: {
            reserved: false,
            reservationName: null,
            reservationPeople: null,
            reservationTime: null,
            reservationNote: null,
          },
        });
        this.server.emit("table:updated", updatedTable);
      }
    }

    this.server.emit("reservation:updated", updated);
    return { ok: true, reservation: updated };
  }

  @SubscribeMessage("reservation:assign_table")
  async handleAssignReservationTable(
    @MessageBody() data: { reservationId: string; tableId: string | null }
  ) {
    const res = await this.prisma.reservation.findUnique({ where: { id: data.reservationId } });
    if (!res) return { ok: false, error: "Réservation introuvable" };

    if (res.tableId && res.tableId !== data.tableId) {
      const oldTable = await this.prisma.table.update({
        where: { id: res.tableId },
        data: {
          reserved: false,
          reservationName: null,
          reservationPeople: null,
          reservationTime: null,
          reservationNote: null,
        },
      });
      this.server.emit("table:updated", oldTable);
    }

    const updated = await this.prisma.reservation.update({
      where: { id: data.reservationId },
      data: { tableId: data.tableId },
      include: { table: true },
    });

    if (data.tableId) {
      const newTable = await this.prisma.table.update({
        where: { id: data.tableId },
        data: {
          reserved: true,
          reservationName: updated.customerName,
          reservationPeople: updated.guests,
          reservationTime: updated.time,
          reservationNote: updated.notes,
        },
      });
      this.server.emit("table:updated", newTable);
    }

    this.server.emit("reservation:updated", updated);
    return { ok: true, reservation: updated };
  }

  @SubscribeMessage("reservation:delete")
  async handleDeleteReservation(@MessageBody() data: { id: string }) {
    const res = await this.prisma.reservation.findUnique({ where: { id: data.id } });
    if (!res) return { ok: false, error: "Réservation introuvable" };

    if (res.tableId) {
      const updatedTable = await this.prisma.table.update({
        where: { id: res.tableId },
        data: {
          reserved: false,
          reservationName: null,
          reservationPeople: null,
          reservationTime: null,
          reservationNote: null,
        },
      });
      this.server.emit("table:updated", updatedTable);
    }

    await this.prisma.reservation.delete({ where: { id: data.id } });
    this.server.emit("reservation:deleted", { id: data.id });
    return { ok: true };
  }

  // ── Handlers Phase 3 : Remises & Réductions ────────────────────

  @SubscribeMessage("order:discount:apply")
  async handleApplyDiscount(
    @MessageBody()
    data: {
      orderId: string;
      discount: {
        type: "percent" | "fixed";
        value: number;
        reason?: string;
        code?: string;
        amount: number;
      };
    }
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });
    if (!order) return { ok: false, error: "Commande introuvable" };

    const updated = await this.prisma.order.update({
      where: { id: data.orderId },
      data: {
        discount: JSON.stringify(data.discount),
      },
      include: { items: true },
    });

    const formatted = this.formatOrder(updated);
    this.server.emit("order:updated", formatted);
    return { ok: true, order: formatted };
  }

  @SubscribeMessage("order:discount:remove")
  async handleRemoveDiscount(@MessageBody() data: { orderId: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });
    if (!order) return { ok: false, error: "Commande introuvable" };

    const updated = await this.prisma.order.update({
      where: { id: data.orderId },
      data: { discount: null },
      include: { items: true },
    });

    const formatted = this.formatOrder(updated);
    this.server.emit("order:updated", formatted);
    return { ok: true, order: formatted };
  }

  // ── Handlers Phase 3 : Configuration Restaurant & Caisse ───────

  @SubscribeMessage("config:get")
  async handleGetConfig() {
    const config = await this.prisma.restaurantConfig.findUnique({ where: { id: "default" } });
    if (!config) return { ok: false, error: "Configuration introuvable" };
    return {
      ok: true,
      config: {
        ...config,
        printers: JSON.parse(config.printers || "[]"),
        promoCodes: JSON.parse(config.promoCodes || "[]"),
      },
    };
  }

  @SubscribeMessage("config:update")
  async handleUpdateConfig(@MessageBody() data: any) {
    const updated = await this.prisma.restaurantConfig.upsert({
      where: { id: "default" },
      update: {
        name: data.name,
        legalName: data.legalName,
        siret: data.siret,
        vatNumber: data.vatNumber,
        address: data.address,
        city: data.city,
        phone: data.phone,
        email: data.email,
        website: data.website,
        footerNote: data.footerNote,
        currency: data.currency || "EUR",
        tpeAutoPrint: data.tpeAutoPrint ?? true,
        printers: typeof data.printers === "string" ? data.printers : JSON.stringify(data.printers || []),
        promoCodes: typeof data.promoCodes === "string" ? data.promoCodes : JSON.stringify(data.promoCodes || []),
      },
      create: {
        id: "default",
        name: data.name || "RestoFlow Bistrot",
        legalName: data.legalName || "RESTOFLOW BISTROT SAS",
        siret: data.siret || "987 654 321 00012",
        vatNumber: data.vatNumber || "FR 12 987654321",
        address: data.address || "14 Rue de la Paix",
        city: data.city || "75002 Paris",
        phone: data.phone || "01 42 68 55 00",
        email: data.email || "contact@restoflow-bistrot.fr",
        website: data.website || "www.restoflow.fr",
        footerNote: data.footerNote || "Merci de votre visite !",
        currency: data.currency || "EUR",
        tpeAutoPrint: data.tpeAutoPrint ?? true,
        printers: typeof data.printers === "string" ? data.printers : JSON.stringify(data.printers || []),
        promoCodes: typeof data.promoCodes === "string" ? data.promoCodes : JSON.stringify(data.promoCodes || []),
      },
    });

    const parsedConfig = {
      ...updated,
      printers: JSON.parse(updated.printers || "[]"),
      promoCodes: JSON.parse(updated.promoCodes || "[]"),
    };

    this.server.emit("config:updated", parsedConfig);
    return { ok: true, config: parsedConfig };
  }

  @SubscribeMessage("order:checkout")
  async handleCheckout(
    @MessageBody()
    data: {
      orderId: string;
      paymentMethod: string;
      payments?: any[];
      serverName?: string;
      subtotal?: number;
      total?: number;
      discount?: any;
      vatDetails?: any;
      ticketNumber?: string;
    }
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true, table: true },
    });
    if (!order) return { ok: false, error: "Commande introuvable" };

    const paidItems = order.items.filter((i) => i.status !== "draft");
    const rawSubtotal = paidItems.reduce((s, i) => s + i.price * i.qty, 0);
    const subtotal = data.subtotal != null ? data.subtotal : rawSubtotal;
    const orderDiscount = data.discount || (order.discount ? JSON.parse(order.discount) : null);
    const discountAmount = orderDiscount ? orderDiscount.amount || 0 : 0;
    const finalTotal = data.total != null ? data.total : Math.max(0, subtotal - discountAmount);
    const paidAt = new Date();

    const historyCount = await this.prisma.orderHistory.count();
    const currentYear = paidAt.getFullYear();
    const ticketNumber =
      data.ticketNumber || `FAC-${currentYear}-${String(historyCount + 1).padStart(4, "0")}`;

    const paymentList =
      data.payments && data.payments.length > 0
        ? data.payments
        : [
            {
              id: `pay_${Date.now()}`,
              label: "Paiement unique",
              amount: finalTotal,
              method: data.paymentMethod || "carte",
              paidAt: paidAt.getTime(),
            },
          ];

    const finalMethod =
      data.paymentMethod || (paymentList.length > 1 ? "partage" : paymentList[0]?.method || "carte");

    // Create history snapshot with Phase 3 fields
    const historyRecord = await this.prisma.orderHistory.create({
      data: {
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        orderId: order.id,
        ticketNumber,
        tableNumber: order.table?.number,
        server: data.serverName || order.server,
        items: JSON.stringify(paidItems),
        subtotal,
        total: finalTotal,
        discount: orderDiscount ? JSON.stringify(orderDiscount) : null,
        vatDetails: data.vatDetails ? (typeof data.vatDetails === "string" ? data.vatDetails : JSON.stringify(data.vatDetails)) : null,
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
      ticketNumber: historyRecord.ticketNumber,
      tableNumber: historyRecord.tableNumber,
      server: historyRecord.server,
      items: paidItems,
      subtotal: historyRecord.subtotal ?? historyRecord.total,
      total: historyRecord.total,
      discount: orderDiscount,
      vatDetails: data.vatDetails || null,
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
      discount: order.discount ? (typeof order.discount === "string" ? JSON.parse(order.discount) : order.discount) : null,
      items: (order.items || []).map((i: any) => {
        const isBar = i.station === "bar" || (i.productId?.startsWith("p18") || i.productId?.startsWith("p19") || i.productId?.startsWith("p20") || i.productId?.startsWith("p21"));
        const course = i.course || (
          isBar ? "boisson"
          : (i.productId === "p1" || i.productId === "p2" || i.productId === "p3") ? "entree"
          : (i.productId === "p15" || i.productId === "p16" || i.productId === "p17") ? "dessert"
          : "plat"
        );
        const courseStatus = i.courseStatus || ((course === "entree" || course === "boisson" || course === "direct") ? "direct" : "held");
        const station = i.station || (isBar ? "bar" : "kitchen");

        return {
          id: i.id,
          productId: i.productId,
          name: i.name,
          price: i.price,
          qty: i.qty,
          notes: i.notes || "",
          status: i.status,
          isMenu: i.isMenu,
          composition: i.composition ? (typeof i.composition === "string" ? JSON.parse(i.composition) : i.composition) : null,
          course,
          courseStatus,
          station,
        };
      }),
    };
  }
}
