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
import { Injectable, Logger, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { OrdersService } from "../orders/orders.service";
import { BillingService } from "../billing/billing.service";
import { ConfigService } from "../config/config.service";
import { StockService } from "../stock/stock.service";
import { TablesService } from "../tables/tables.service";
import { PrinterService } from "../printer/printer.service";
import { RecipesService } from "../recipes/recipes.service";
import { ClosingService } from "../closing/closing.service";
import { CatalogService } from "../catalog/catalog.service";
import { WsPermissionsGuard } from "../auth/guards/ws-permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { AddItemDto } from "../orders/dto/add-item.dto";
import { ChangeQtyDto } from "../orders/dto/change-qty.dto";
import { CheckoutDto } from "../orders/dto/checkout.dto";
import { StockMovementDto } from "../stock/dto/stock-movement.dto";
import { TransferTableDto, MergeTableDto } from "../tables/dto/table-action.dto";
import { CreateReservationDto } from "../tables/dto/reservation.dto";

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ["http://localhost:5173", "http://localhost:4173"],
  },
})
@UseGuards(WsPermissionsGuard)
@Injectable()
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private ordersService: OrdersService,
    private billingService: BillingService,
    private configService: ConfigService,
    private stockService: StockService,
    private tablesService: TablesService,
    private printerService: PrinterService,
    private recipesService: RecipesService,
    private closingService: ClosingService,
    private catalogService: CatalogService
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    try {
      const fullState = await this.getFullState();
      client.emit("sync:init", fullState);
    } catch (err) {
      this.logger.error("Error sending initial sync to client", err);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * État initial global sécurisé (les PINs sont strictement exclus)
   */
  public async getFullState() {
    const [
      tables,
      rawOrders,
      products,
      menus,
      roles,
      staff,
      rawHistory,
      rawIngredients,
      rawRecipes,
      rawMovements,
      rawConfig,
      rawReservations,
      closings,
    ] = await Promise.all([
      this.prisma.table.findMany({ orderBy: { number: "asc" } }),
      this.prisma.order.findMany({
        where: { status: "open" },
        include: { items: true, table: true },
      }),
      this.prisma.product.findMany(),
      this.prisma.menu.findMany(),
      this.prisma.role.findMany(),
      // 🔒 Sécurité Axe 1 : EXCLUSION TOTALE des PINs
      this.prisma.staff.findMany({
        select: {
          id: true,
          name: true,
          roleId: true,
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
      this.configService.getConfig(),
      this.prisma.reservation.findMany({
        orderBy: [{ date: "asc" }, { time: "asc" }],
      }),
      this.closingService.getClosingsHistory(50),
    ]);

    const parsedOrders = rawOrders.map((o) => this.ordersService.formatOrder(o));

    const parsedProducts = products.map((p) => ({
      ...p,
      emoji: p.emoji || "🍽️",
      allergens: JSON.parse(p.allergens || "[]"),
    }));

    const parsedMenus = menus.map((m) => ({
      ...m,
      emoji: m.emoji || "📋",
      groups: JSON.parse(m.groups || "[]"),
    }));

    const parsedRoles = roles.map((r) => ({
      ...r,
      permissions: JSON.parse(r.permissions || "[]"),
    }));

    const parsedHistory = rawHistory.map((h) => ({
      id: h.id,
      orderId: h.orderId,
      ticketNumber: h.ticketNumber,
      tableNumber: h.tableNumber,
      server: h.server,
      items: JSON.parse(h.items || "[]"),
      subtotal: h.subtotal ?? h.total,
      total: h.total,
      discount: h.discount ? JSON.parse(h.discount) : null,
      vatDetails: h.vatDetails ? JSON.parse(h.vatDetails) : null,
      paymentMethod: h.paymentMethod,
      payments: JSON.parse(h.payments || "[]"),
      createdAt: h.createdAt.getTime(),
    }));

    const parsedIngredients = rawIngredients.map((ing) => ({
      ...ing,
      status: ing.currentStock <= 0 ? "out" : ing.currentStock <= ing.minThreshold ? "low" : "ok",
      stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
    }));

    const parsedRecipes = rawRecipes.map((rc) => ({
      id: rc.id,
      productId: rc.productId,
      ingredientId: rc.ingredientId,
      ingredientName: rc.ingredient.name,
      quantity: rc.quantity,
      unit: rc.unit,
      costPerUnit: rc.ingredient.costPerUnit,
      currentStock: rc.ingredient.currentStock,
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
      config: rawConfig,
      reservations: rawReservations,
      closings,
    };
  }

  // ── Synchronisation & Auth (Axe 1) ──────────────────────────────────

  @SubscribeMessage("sync:request")
  async handleSyncRequest(@ConnectedSocket() _client: Socket) {
    const fullState = await this.getFullState();
    return { ok: true, state: fullState };
  }

  @SubscribeMessage("auth:verify_pin")
  async handleVerifyPin(@MessageBody() data: { pin: string; staffId?: string }) {
    try {
      const result = await this.authService.verifyPin(data.pin, data.staffId);
      return result;
    } catch (err: any) {
      return { ok: false, error: err.message || "Code PIN incorrect" };
    }
  }

  // ── Tables & Salle Dynamique ────────────────────────────────────────

  @SubscribeMessage("tables:toggle_alert")
  async handleToggleAlert(@MessageBody() data: { tableId: string }) {
    try {
      const updated = await this.tablesService.toggleAlert(data.tableId);
      this.server.emit("table:updated", updated);
      return { ok: true, table: updated };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("salle.order", "gestion.tables")
  @SubscribeMessage("tables:transfer")
  async handleTableTransfer(
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) data: TransferTableDto
  ) {
    try {
      const res = await this.tablesService.transferTable(data.sourceTableId, data.targetTableId);
      const formattedOrder = this.ordersService.formatOrder(res.order);

      this.server.emit("table:updated", res.sourceTable);
      this.server.emit("table:updated", res.targetTable);
      this.server.emit("order:updated", formattedOrder);
      this.server.emit("tables:transferred", {
        sourceTableNumber: res.sourceNumber,
        targetTableNumber: res.targetNumber,
        server: data.staffName || res.server,
      });

      return { ok: true, order: formattedOrder };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("salle.order", "gestion.tables")
  @SubscribeMessage("tables:merge")
  async handleTableMerge(
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) data: MergeTableDto
  ) {
    try {
      const res = await this.tablesService.mergeTables(data.sourceTableId, data.targetTableId);
      const formattedTargetOrder = this.ordersService.formatOrder(res.targetOrder);

      this.server.emit("order:closed", { orderId: res.closedOrderId });
      this.server.emit("order:updated", formattedTargetOrder);
      this.server.emit("table:updated", res.sourceTable);
      this.server.emit("table:updated", res.targetTable);
      this.server.emit("tables:merged", {
        sourceTableNumber: res.sourceNumber,
        targetTableNumber: res.targetNumber,
        server: data.staffName || res.server,
      });

      return { ok: true, order: formattedTargetOrder };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // ── Cycle de Vie des Commandes (OrdersService) ──────────────────────

  @SubscribeMessage("order:create_or_ensure")
  async handleEnsureOrder(
    @MessageBody() data: { tableId: string; server: string; orderId?: string }
  ) {
    try {
      const order = await this.ordersService.createOrEnsure(data.tableId, data.server, data.orderId);
      this.server.emit("order:updated", order);
      return { ok: true, order };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("order:add_item")
  async handleAddItem(@MessageBody(new ValidationPipe({ whitelist: true, transform: true })) data: AddItemDto) {
    try {
      const order = await this.ordersService.addItem(data);
      this.server.emit("order:updated", order);
      return { ok: true, order };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("order:change_qty")
  async handleChangeQty(
    @MessageBody() data: { orderId: string; itemId: string; delta: number }
  ) {
    try {
      const order = await this.ordersService.changeQty(data.orderId, data.itemId, data.delta);
      this.server.emit("order:updated", order);
      return { ok: true, order };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("order:remove_item")
  async handleRemoveItem(@MessageBody() data: { orderId: string; itemId: string }) {
    try {
      const order = await this.ordersService.removeItem(data.orderId, data.itemId);
      this.server.emit("order:updated", order);
      return { ok: true, order };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("order:set_note")
  async handleSetNote(
    @MessageBody() data: { orderId: string; itemId: string; note: string }
  ) {
    try {
      const order = await this.ordersService.setNote(data.orderId, data.itemId, data.note);
      this.server.emit("order:updated", order);
      return { ok: true, order };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("order:send_kitchen")
  async handleSendKitchen(
    @MessageBody() data: { orderId: string; serverName?: string }
  ) {
    try {
      // 1. Décompte automatique et atomique des stocks (Axe 2 & 5)
      const stockResult = await this.stockService.deductForOrder(data.orderId);
      if (stockResult) {
        for (const msg of stockResult.stockAlerts) {
          this.server.emit("stock:alert", { message: msg });
        }
        if (stockResult.affectedProducts.length > 0) {
          const allProducts = await this.prisma.product.findMany();
          this.server.emit(
            "catalog:products_updated",
            allProducts.map((p) => ({
              ...p,
              emoji: p.emoji || "🍽️",
              allergens: JSON.parse(p.allergens || "[]"),
            }))
          );
        }
        this.server.emit("stock:updated", stockResult.refreshedIngredients);
        this.server.emit("stock:movements_updated", stockResult.recentMovements);
      }

      // 2. Passage des articles de la commande en statut "new"
      const { order, rawOrder } = await this.ordersService.sendKitchen(data.orderId, data.serverName);
      this.server.emit("order:updated", order);
      this.server.emit("kitchen:new_ticket", {
        orderId: rawOrder.id,
        tableNumber: rawOrder.table?.number,
        server: rawOrder.server,
      });

      // 3. Impression Réseau Automatique & Silencieuse (Axe 4 Option A)
      this.attemptAutoKitchenPrint(order).catch((e) =>
        this.logger.warn(`Échec de l'impression réseau automatique cuisine: ${e.message}`)
      );

      return { ok: true, order };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  private async attemptAutoKitchenPrint(order: any) {
    const cfg = await this.configService.getConfig();
    const kitchenPrinter = cfg.printers?.find(
      (p: any) => p.type === "kitchen" && p.interface === "network" && p.enabled && p.ip
    );
    if (kitchenPrinter) {
      this.logger.log(`Impression automatique du bon cuisine vers ${kitchenPrinter.ip}:${kitchenPrinter.port || 9100}`);
      const rawText = `\x1b\x40\x1b\x61\x01--- BON DE CUISINE ---\nTABLE ${order.table?.number || "?"}\nServeur: ${order.server}\nHeure: ${new Date().toLocaleTimeString()}\n\n\x1b\x61\x00` +
        order.items
          .map((i: any) => `${i.qty}x ${i.name} ${i.notes ? `(${i.notes})` : ""}`)
          .join("\n") +
        `\n\n\n\x1d\x56\x01`;
      await this.printerService.sendRaw(kitchenPrinter.ip, kitchenPrinter.port || 9100, Buffer.from(rawText, "latin1"));
    }
  }

  @SubscribeMessage("order:start_prep")
  async handleStartPrep(@MessageBody() data: { orderId: string; station?: string }) {
    try {
      const order = await this.ordersService.startPrep(data.orderId, data.station);
      this.server.emit("order:updated", order);
      return { ok: true, order };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("order:mark_ready")
  async handleMarkReady(@MessageBody() data: { orderId: string; station?: string }) {
    try {
      const order = await this.ordersService.markReady(data.orderId, data.station);
      this.server.emit("order:updated", order);
      this.server.emit("server:order_ready", {
        orderId: order.id,
        tableNumber: order.table?.number,
        station: data.station || "all",
      });
      return { ok: true, order };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("order:serve")
  async handleServe(@MessageBody() data: { orderId: string; course?: string }) {
    try {
      const order = await this.ordersService.serve(data.orderId, data.course);
      this.server.emit("order:updated", order);
      return { ok: true, order };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("order:call_course")
  async handleCallCourse(
    @MessageBody() data: { orderId: string; course: string; serverName?: string }
  ) {
    try {
      const res = await this.ordersService.callCourse(data.orderId, data.course, data.serverName);
      this.server.emit("order:updated", res.order);

      const courseLabel =
        data.course === "plat"
          ? "Plats"
          : data.course === "dessert"
          ? "Desserts"
          : data.course === "suite"
          ? "Suite"
          : data.course;

      this.server.emit("kitchen:call_course", {
        orderId: res.rawOrder.id,
        tableNumber: res.rawOrder.table?.number || "?",
        course: data.course,
        courseLabel,
        server: data.serverName || res.rawOrder.server,
        itemCount: res.calledCount,
        timestamp: Date.now(),
      });

      return { ok: true, order: res.order, calledCount: res.calledCount };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("order:change_item_course")
  async handleChangeItemCourse(
    @MessageBody() data: { itemId: string; course: string; courseStatus?: string }
  ) {
    try {
      const order = await this.ordersService.changeItemCourse(data.itemId, data.course, data.courseStatus);
      this.server.emit("order:updated", order);
      return { ok: true, order };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // ── Facturation, Caisse & Remises (BillingService) ──────────────────

  @RequirePermissions("caisse.discount")
  @SubscribeMessage("order:discount:apply")
  async handleApplyDiscount(@MessageBody() data: { orderId: string; discount: any }) {
    try {
      const res = await this.billingService.applyDiscount(data.orderId, data.discount);
      const formatted = this.ordersService.formatOrder(res.order);
      this.server.emit("order:updated", formatted);
      return { ok: true, order: formatted };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.discount")
  @SubscribeMessage("order:discount:remove")
  async handleRemoveDiscount(@MessageBody() data: { orderId: string }) {
    try {
      const res = await this.billingService.removeDiscount(data.orderId);
      const formatted = this.ordersService.formatOrder(res.order);
      this.server.emit("order:updated", formatted);
      return { ok: true, order: formatted };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.checkout")
  @SubscribeMessage("order:checkout")
  async handleCheckout(
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) data: CheckoutDto
  ) {
    try {
      const res = await this.billingService.processCheckout(data);

      this.server.emit("order:closed", { orderId: res.orderId });
      this.server.emit("table:updated", res.table);
      this.server.emit("history:new_entry", res.history);

      // Impression automatique du ticket de caisse si configurée
      this.attemptAutoCaissePrint(res.history).catch((e) =>
        this.logger.warn(`Échec de l'impression réseau automatique caisse: ${e.message}`)
      );

      return { ok: true, history: res.history, table: res.table };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  private async attemptAutoCaissePrint(historyRecord: any) {
    const cfg = await this.configService.getConfig();
    const caissePrinter = cfg.printers?.find(
      (p: any) => p.type === "caisse" && p.interface === "network" && p.enabled && p.ip
    );
    if (caissePrinter) {
      this.logger.log(`Impression automatique facturette vers ${caissePrinter.ip}:${caissePrinter.port || 9100}`);
      const rawText = `\x1b\x40\x1b\x61\x01${cfg.name || "RestoFlow"}\n${cfg.legalName || ""}\nSIRET: ${cfg.siret || ""}\n\nFacture: ${historyRecord.ticketNumber}\nTable: ${historyRecord.tableNumber || "?"}\nDate: ${new Date(historyRecord.createdAt).toLocaleString()}\n\n\x1b\x61\x00` +
        historyRecord.items
          .map((i: any) => `${i.qty}x ${i.name.padEnd(20)} ${Number(i.price * i.qty).toFixed(2)}E`)
          .join("\n") +
        `\n--------------------------------\n\x1b\x61\x02TOTAL TTC: ${Number(historyRecord.total).toFixed(2)} EUR\n\n\x1b\x61\x01${cfg.footerNote || "Merci de votre visite"}\n\n\n\x1d\x56\x01\x1b\x70\x00\x19\xfa`;
      await this.printerService.sendRaw(caissePrinter.ip, caissePrinter.port || 9100, Buffer.from(rawText, "latin1"));
    }
  }

  // ── Impression Matérielle Directe (Axe 4) ───────────────────────────

  @RequirePermissions("admin.printers")
  @SubscribeMessage("printer:test")
  async handlePrinterTest(@MessageBody() data: { ip: string; port?: number }) {
    try {
      const cfg = await this.configService.getConfig();
      const allowedIps = (cfg.printers || []).map((p: any) => p.ip).filter(Boolean);
      if (!allowedIps.includes(data.ip)) {
        return { success: false, error: `IP ${data.ip} non autorisée. Configurez l'imprimante dans Caisse & Imprimantes.` };
      }
      const res = await this.printerService.testPrinter(data.ip, data.port || 9100);
      return res;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  @RequirePermissions("admin.printers")
  @SubscribeMessage("printer:send_raw")
  async handlePrinterSendRaw(@MessageBody() data: { ip: string; port?: number; buffer: number[] | string }) {
    try {
      const cfg = await this.configService.getConfig();
      const allowedIps = (cfg.printers || []).map((p: any) => p.ip).filter(Boolean);
      if (!allowedIps.includes(data.ip)) {
        return { success: false, error: `IP ${data.ip} non autorisée. Configurez l'imprimante dans Caisse & Imprimantes.` };
      }
      const buffer = Array.isArray(data.buffer)
        ? Buffer.from(data.buffer)
        : Buffer.from(data.buffer, "base64");
      const res = await this.printerService.sendRaw(data.ip, data.port || 9100, buffer);
      return res;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ── Configuration Restaurant (ConfigService) ────────────────────────

  @SubscribeMessage("config:get")
  async handleGetConfig() {
    const config = await this.configService.getConfig();
    return { ok: true, config };
  }

  @RequirePermissions("caisse.settings")
  @SubscribeMessage("config:update")
  async handleUpdateConfig(@MessageBody() data: any) {
    try {
      const updated = await this.configService.updateConfig(data);
      this.server.emit("config:updated", updated);
      return { ok: true, config: updated };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // ── Réservations ────────────────────────────────────────────────────

  @SubscribeMessage("reservation:create")
  async handleCreateReservation(@MessageBody(new ValidationPipe({ whitelist: true, transform: true })) data: CreateReservationDto) {
    try {
      const res = await this.prisma.reservation.create({
        data: {
          id: data.id || `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          customerName: data.customerName,
          phone: data.phone,
          email: data.email || null,
          date: data.date,
          time: data.time,
          guests: Number(data.guests) || 2,
          status: data.status || "confirmed",
          tableId: data.tableId || null,
          notes: data.notes || null,
        },
      });
      this.server.emit("reservation:created", res);
      return { ok: true, reservation: res };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("reservation:update_status")
  async handleUpdateReservationStatus(@MessageBody() data: { id: string; status: string }) {
    try {
      const res = await this.prisma.reservation.update({
        where: { id: data.id },
        data: { status: data.status },
      });
      this.server.emit("reservation:updated", res);
      return { ok: true, reservation: res };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("reservation:assign_table")
  async handleAssignReservationTable(@MessageBody() data: { id: string; tableId: string | null }) {
    try {
      const res = await this.prisma.reservation.update({
        where: { id: data.id },
        data: { tableId: data.tableId },
      });
      this.server.emit("reservation:updated", res);
      return { ok: true, reservation: res };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("reservation:delete")
  async handleDeleteReservation(@MessageBody() data: { id: string }) {
    try {
      await this.prisma.reservation.delete({ where: { id: data.id } });
      this.server.emit("reservation:deleted", { id: data.id });
      return { ok: true, id: data.id };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // ── Stocks & Recettes (StockService & RecipesService) ───────────────

  @SubscribeMessage("stock:request_sync")
  async handleStockSync() {
    const [ingredients, movements] = await Promise.all([
      this.stockService.findAllIngredients(),
      this.stockService.getMovements(100),
    ]);
    return { ok: true, ingredients, movements };
  }

  @RequirePermissions("gestion.stocks")
  @SubscribeMessage("stock:add_movement")
  async handleAddStockMovement(
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) data: StockMovementDto
  ) {
    try {
      const result = await this.stockService.recordMovement({
        ingredientId: data.ingredientId,
        type: data.type,
        quantity: Number(data.quantity),
        unitCost: data.unitCost !== undefined ? Number(data.unitCost) : undefined,
        reason: data.reason,
        staffId: data.staffId,
        orderId: data.orderId,
      });

      const [refreshedIngredients, movements] = await Promise.all([
        this.prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
        this.stockService.getMovements(60),
      ]);

      const formattedIngredients = refreshedIngredients.map((ing) => ({
        ...ing,
        status: ing.currentStock <= 0 ? "out" : ing.currentStock <= ing.minThreshold ? "low" : "ok",
        stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
      }));

      this.server.emit("stock:updated", formattedIngredients);
      this.server.emit("stock:movements_updated", movements);

      if (result.affectedProducts.length > 0) {
        const products = await this.prisma.product.findMany();
        this.server.emit(
          "catalog:products_updated",
          products.map((p) => ({
            ...p,
            emoji: p.emoji || "🍽️",
            allergens: JSON.parse(p.allergens || "[]"),
          }))
        );
      }

      return { ok: true, movement: result.movement, ingredient: result.ingredient };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("gestion.stocks")
  @SubscribeMessage("stock:create_ingredient")
  async handleCreateIngredient(@MessageBody() data: any) {
    try {
      const created = await this.stockService.createIngredient(data);
      const ingredients = await this.stockService.findAllIngredients();
      const movements = await this.stockService.getMovements(60);
      this.server.emit("stock:updated", ingredients);
      this.server.emit("stock:movements_updated", movements);
      return { ok: true, ingredient: created };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("gestion.stocks")
  @SubscribeMessage("stock:update_ingredient")
  async handleUpdateIngredient(@MessageBody() data: { id: string; [key: string]: any }) {
    try {
      const { id, ...rest } = data;
      const updated = await this.stockService.updateIngredient(id, rest);
      const ingredients = await this.stockService.findAllIngredients();
      const movements = await this.stockService.getMovements(60);
      this.server.emit("stock:updated", ingredients);
      this.server.emit("stock:movements_updated", movements);
      return { ok: true, ingredient: updated };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("gestion.stocks")
  @SubscribeMessage("stock:delete_ingredient")
  async handleDeleteIngredient(@MessageBody() data: { id: string }) {
    try {
      await this.stockService.deleteIngredient(data.id);
      const ingredients = await this.stockService.findAllIngredients();
      this.server.emit("stock:updated", ingredients);
      return { ok: true, id: data.id };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("gestion.stocks")
  @SubscribeMessage("stock:restore_ingredient")
  async handleRestoreIngredient(@MessageBody() data: { id: string }) {
    try {
      await this.stockService.restoreIngredient(data.id);
      const ingredients = await this.stockService.findAllIngredients();
      this.server.emit("stock:updated", ingredients);
      return { ok: true, id: data.id };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("gestion.recipes")
  @SubscribeMessage("recipe:save")
  async handleSaveRecipe(@MessageBody() data: { productId: string; items: any[] }) {
    try {
      await this.recipesService.saveRecipe(data.productId, data.items);
      const recipes = await this.prisma.recipeItem.findMany({
        include: {
          ingredient: {
            select: { id: true, name: true, unit: true, costPerUnit: true, currentStock: true },
          },
        },
      });
      const parsedRecipes = recipes.map((rc) => ({
        id: rc.id,
        productId: rc.productId,
        ingredientId: rc.ingredientId,
        ingredientName: rc.ingredient.name,
        quantity: rc.quantity,
        unit: rc.unit,
        costPerUnit: rc.ingredient.costPerUnit,
        currentStock: rc.ingredient.currentStock,
        isCritical: rc.isCritical,
        notes: rc.notes || "",
      }));
      this.server.emit("recipe:updated", parsedRecipes);
      return { ok: true, recipes: parsedRecipes };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("gestion.products")
  @SubscribeMessage("catalog:create_product")
  async handleCreateProduct(@MessageBody() data: any) {
    try {
      const created = await this.catalogService.createProduct(data);
      const allProducts = await this.catalogService.getProducts();
      this.server.emit("catalog:products_updated", allProducts);
      return { ok: true, product: created };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("gestion.products", "gestion.stocks")
  @SubscribeMessage("catalog:create_product_with_stock")
  async handleCreateProductWithStock(@MessageBody() data: any) {
    try {
      const result = await this.catalogService.createProductWithStock(data);
      const allProducts = await this.catalogService.getProducts();
      const allIngredients = await this.stockService.findAllIngredients();
      const movements = await this.stockService.getMovements(60);
      const recipes = await this.prisma.recipeItem.findMany({
        include: {
          ingredient: {
            select: { id: true, name: true, unit: true, costPerUnit: true, currentStock: true },
          },
        },
      });
      const parsedRecipes = recipes.map((rc) => ({
        id: rc.id,
        productId: rc.productId,
        ingredientId: rc.ingredientId,
        ingredientName: rc.ingredient.name,
        quantity: rc.quantity,
        unit: rc.unit,
        costPerUnit: rc.ingredient.costPerUnit,
        currentStock: rc.ingredient.currentStock,
        isCritical: rc.isCritical,
        notes: rc.notes || "",
      }));

      this.server.emit("catalog:products_updated", allProducts);
      this.server.emit("stock:updated", allIngredients);
      this.server.emit("stock:movements_updated", movements);
      this.server.emit("recipe:updated", parsedRecipes);

      return { ok: true, ...result };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("gestion.products")
  @SubscribeMessage("catalog:update_product")
  async handleUpdateProduct(@MessageBody() data: { id: string; [key: string]: any }) {
    try {
      const { id, ...rest } = data;
      const updated = await this.catalogService.updateProduct(id, rest);
      const allProducts = await this.catalogService.getProducts();
      this.server.emit("catalog:products_updated", allProducts);
      return { ok: true, product: updated };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("gestion.products")
  @SubscribeMessage("catalog:delete_product")
  async handleDeleteProduct(@MessageBody() data: { id: string }) {
    try {
      await this.catalogService.deleteProduct(data.id);
      const allProducts = await this.catalogService.getProducts();
      this.server.emit("catalog:products_updated", allProducts);
      return { ok: true, id: data.id };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("catalog:toggle_product_available")
  async handleToggleProductAvailable(@MessageBody() data: { productId: string }) {
    try {
      const p = await this.prisma.product.findUnique({ where: { id: data.productId } });
      if (!p) return { ok: false, error: "Produit introuvable" };

      const updated = await this.prisma.product.update({
        where: { id: data.productId },
        data: { available: !p.available },
      });

      const allProducts = await this.prisma.product.findMany();
      this.server.emit(
        "catalog:products_updated",
        allProducts.map((prod) => ({
          ...prod,
          emoji: prod.emoji || "🍽️",
          allergens: JSON.parse(prod.allergens || "[]"),
        }))
      );
      return { ok: true, product: updated };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // ── Clôture de Caisse & Conformité Fiscale (ClosingService - Phase 7) ──

  @SubscribeMessage("closing:get_x")
  async handleGetXReport() {
    try {
      const report = await this.closingService.getXReport();
      return { ok: true, report };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.checkout", "caisse.settings")
  @SubscribeMessage("closing:process_z")
  async handleProcessZClosing(@MessageBody() data: any) {
    try {
      const zReport = await this.closingService.processZClosing({
        closedBy: data.closedBy,
        openingCash: data.openingCash,
        countedCash: data.countedCash,
        notes: data.notes,
      });

      // Diffusion temps réel de la nouvelle clôture Z à tous les postes connectés
      this.server.emit("closing:new_z", zReport);

      // Recharger l'état de la config et de l'historique
      const updatedConfig = await this.configService.getConfig();
      this.server.emit("config:updated", updatedConfig);

      return { ok: true, closing: zReport };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("closing:get_history")
  async handleGetClosingHistory(@MessageBody() data?: { limit?: number }) {
    try {
      const list = await this.closingService.getClosingsHistory(data?.limit || 50);
      return { ok: true, closings: list };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("closing:verify_chain")
  async handleVerifyFiscalChain() {
    try {
      const audit = await this.closingService.verifyFiscalChainIntegrity();
      return { ok: true, audit };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("closing:get_fec")
  async handleGetFecExport(@MessageBody() data?: any) {
    try {
      const fec = await this.closingService.generateFecExport(data || {});
      return { ok: true, fec };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}
