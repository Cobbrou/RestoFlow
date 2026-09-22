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
    const [tables, rawOrders, products, menus, roles, staff, rawHistory] = await Promise.all([
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

    return {
      tables,
      orders: parsedOrders,
      products: parsedProducts,
      menus: parsedMenus,
      roles: parsedRoles,
      staff,
      history: parsedHistory,
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
