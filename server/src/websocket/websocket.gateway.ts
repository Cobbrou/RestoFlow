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
import { Injectable, Logger, UseGuards, UseInterceptors, ValidationPipe } from "@nestjs/common";
import { ClientActionInterceptor } from "./client-action.interceptor";
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
import { JournalService } from "../journal/journal.service";
import { toClientHistory } from "../billing/billing.service";
import { WsPermissionsGuard } from "../auth/guards/ws-permissions.guard";
import { WsAuthGuard, authenticateSocket } from "../auth/guards/ws-auth.guard";
import { Public } from "../auth/decorators/public.decorator";
import { ALLOWED_ORIGINS } from "../cors";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CheckoutDto } from "../orders/dto/checkout.dto";
import { StockMovementDto } from "../stock/dto/stock-movement.dto";
import { TransferTableDto, MergeTableDto } from "../tables/dto/table-action.dto";

@WebSocketGateway({
  cors: {
    origin: ALLOWED_ORIGINS,
  },
})
// 🔒 Toute action exige une session valide (sauf @Public), puis les permissions déclarées
@UseGuards(WsAuthGuard, WsPermissionsGuard)
// Idempotence : une action déjà appliquée (même clientActionId) n'est jamais rejouée
@UseInterceptors(ClientActionInterceptor)
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
    private catalogService: CatalogService,
    private journal: JournalService
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    try {
      // Sans session : uniquement de quoi afficher l'écran de connexion PIN
      if (!authenticateSocket(client, this.authService)) {
        client.emit("sync:init", await this.getPublicState());
        client.emit("auth:required");
        return;
      }
      client.emit("auth:ok");
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
   * État minimal exposé avant authentification (sélection de l'équipier au clavier PIN)
   */
  private async getPublicState() {
    const [staff, roles] = await Promise.all([
      this.prisma.staff.findMany({
        where: { active: true },
        select: { id: true, name: true, roleId: true, active: true, avatarBg: true },
      }),
      this.prisma.role.findMany(),
    ]);
    return {
      staff,
      roles: roles.map((r) => ({ ...r, permissions: JSON.parse(r.permissions || "[]") })),
    };
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
      this.catalogService.getProducts(),
      this.catalogService.getMenus(),
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
      this.recipesService.listItems(),
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

    const parsedRoles = roles.map((r) => ({
      ...r,
      permissions: JSON.parse(r.permissions || "[]"),
    }));

    const parsedHistory = rawHistory.map(toClientHistory);

    const parsedIngredients = rawIngredients.map((ing) => ({
      ...ing,
      status: ing.currentStock <= 0 ? "out" : ing.currentStock <= ing.minThreshold ? "low" : "ok",
      stockValue: Number((ing.currentStock * ing.costPerUnit).toFixed(2)),
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
      products,
      menus,
      roles: parsedRoles,
      staff,
      history: parsedHistory,
      ingredients: parsedIngredients,
      recipes: rawRecipes,
      stockMovements: parsedMovements,
      config: rawConfig,
      reservations: rawReservations,
      closings,
    };
  }

  // ── Synchronisation & Auth (Axe 1) ──────────────────────────────────

  @Public()
  @SubscribeMessage("sync:request")
  async handleSyncRequest(@ConnectedSocket() client: Socket) {
    if (!authenticateSocket(client, this.authService)) {
      return { ok: true, state: await this.getPublicState(), authRequired: true };
    }
    const fullState = await this.getFullState();
    return { ok: true, state: fullState };
  }

  @Public()
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
  async handleAddItem(@MessageBody() data: any) {
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
          this.server.emit("catalog:products_updated", await this.catalogService.getProducts());
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
  async handleApplyDiscount(@ConnectedSocket() client: Socket, @MessageBody() data: { orderId: string; discount: any }) {
    try {
      const res = await this.billingService.applyDiscount(data.orderId, data.discount);
      const formatted = this.ordersService.formatOrder(res.order);
      this.server.emit("order:updated", formatted);
      await this.journal.log("DISCOUNT_APPLY", { staffId: client.data.user.staffId, name: client.data.user.name }, { orderId: data.orderId, discount: formatted.discount });
      return { ok: true, order: formatted };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.discount")
  @SubscribeMessage("order:discount:remove")
  async handleRemoveDiscount(@ConnectedSocket() client: Socket, @MessageBody() data: { orderId: string }) {
    try {
      const res = await this.billingService.removeDiscount(data.orderId);
      const formatted = this.ordersService.formatOrder(res.order);
      this.server.emit("order:updated", formatted);
      await this.journal.log("DISCOUNT_REMOVE", { staffId: client.data.user.staffId, name: client.data.user.name }, { orderId: data.orderId });
      return { ok: true, order: formatted };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.checkout")
  @SubscribeMessage("order:checkout")
  async handleCheckout(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe({ whitelist: true, transform: true })) data: CheckoutDto
  ) {
    try {
      const res = await this.billingService.processCheckout({ ...data, serverName: client.data.user.name });

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
        (historyRecord.tip > 0 ? `\nPourboire: ${Number(historyRecord.tip).toFixed(2)}E` : "") +
        `\n--------------------------------\n\x1b\x61\x02TOTAL TTC: ${Number(historyRecord.total).toFixed(2)} EUR\n\n\x1b\x61\x01${cfg.footerNote || "Merci de votre visite"}\n\n\n\x1d\x56\x01\x1b\x70\x00\x19\xfa`;
      await this.printerService.sendRaw(caissePrinter.ip, caissePrinter.port || 9100, Buffer.from(rawText, "latin1"));
    }
  }

  // ── Impression Matérielle Directe (Axe 4) ───────────────────────────

  // Anti-SSRF : seules les IP d'imprimantes déclarées dans la configuration sont joignables
  private async assertKnownPrinterIp(ip: string) {
    const cfg = await this.configService.getConfig();
    const allowedIps = (cfg.printers || []).map((p: any) => p.ip).filter(Boolean);
    if (!allowedIps.includes(ip)) {
      throw new Error(`IP ${ip} non autorisée. Configurez l'imprimante dans Caisse & Imprimantes.`);
    }
  }

  @RequirePermissions("caisse.settings")
  @SubscribeMessage("printer:test")
  async handlePrinterTest(@MessageBody() data: { ip: string; port?: number }) {
    try {
      await this.assertKnownPrinterIp(data.ip);
      const res = await this.printerService.testPrinter(data.ip, data.port || 9100);
      return res;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.settings")
  @SubscribeMessage("printer:send_raw")
  async handlePrinterSendRaw(@MessageBody() data: { ip: string; port?: number; buffer: number[] | string }) {
    try {
      await this.assertKnownPrinterIp(data.ip);
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
  async handleUpdateConfig(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    try {
      const updated = await this.configService.updateConfig(data);
      this.server.emit("config:updated", updated);
      await this.journal.log("CONFIG_UPDATE", { staffId: client.data.user.staffId, name: client.data.user.name }, { fields: Object.keys(data || {}) });
      return { ok: true, config: updated };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.settings")
  @SubscribeMessage("config:update_modules")
  async handleUpdateModules(@ConnectedSocket() client: Socket, @MessageBody() data: { modules: any }) {
    try {
      const updated = await this.configService.updateModulesConfig(data.modules);
      this.server.emit("config:modules_updated", updated.modulesConfig);
      this.server.emit("config:updated", updated);
      await this.journal.log("CONFIG_UPDATE", { staffId: client.data.user.staffId, name: client.data.user.name }, { fields: ["modulesConfig"] });
      return { ok: true, modulesConfig: updated.modulesConfig };
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
        this.server.emit("catalog:products_updated", await this.catalogService.getProducts());
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
      const parsedRecipes = await this.recipesService.listItems();
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
      const parsedRecipes = await this.recipesService.listItems();

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

  // « 86 » : cuisine, responsable de salle (gestion des tables) ou gestion du catalogue
  @RequirePermissions("cuisine.status", "gestion.tables", "gestion.products")
  @SubscribeMessage("catalog:toggle_product_available")
  async handleToggleProductAvailable(@ConnectedSocket() client: Socket, @MessageBody() data: { productId: string }) {
    try {
      const p = await this.prisma.product.findUnique({ where: { id: data.productId } });
      if (!p) return { ok: false, error: "Produit introuvable" };

      const updated = await this.prisma.product.update({
        where: { id: data.productId },
        data: { available: !p.available },
      });

      this.server.emit("catalog:products_updated", await this.catalogService.getProducts());
      // Annonce « 86 » à tous les postes (salle comprise) pour ne plus vendre le plat
      this.server.emit("catalog:product_86", { name: updated.name, available: updated.available, by: client.data.user?.name });
      return { ok: true, product: updated };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // ── Clôture de Caisse & Conformité Fiscale (ClosingService - Phase 7) ──

  @RequirePermissions("caisse.close", "caisse.history")
  @SubscribeMessage("closing:get_x")
  async handleGetXReport() {
    try {
      const report = await this.closingService.getXReport();
      return { ok: true, report };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.close")
  @SubscribeMessage("closing:process_z")
  async handleProcessZClosing(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    try {
      const zReport = await this.closingService.processZClosing({
        // Le Z est signé au nom de la session, jamais d'un nom fourni par le client
        closedBy: client.data.user.name,
        openingCash: data.openingCash,
        countedCash: data.countedCash,
        notes: data.notes,
      });

      // Diffusion temps réel de la nouvelle clôture Z à tous les postes connectés
      this.server.emit("closing:new_z", zReport);
      await this.journal.log("Z_CLOSING", { staffId: client.data.user.staffId, name: client.data.user.name }, { reportNumber: zReport.reportNumber, totalNet: zReport.totalNet });

      // Recharger l'état de la config et de l'historique
      const updatedConfig = await this.configService.getConfig();
      this.server.emit("config:updated", updatedConfig);

      return { ok: true, closing: zReport };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.close", "caisse.history")
  @SubscribeMessage("closing:get_history")
  async handleGetClosingHistory(@MessageBody() data?: { limit?: number }) {
    try {
      const list = await this.closingService.getClosingsHistory(data?.limit || 50);
      return { ok: true, closings: list };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.fec", "caisse.close")
  @SubscribeMessage("closing:verify_chain")
  async handleVerifyFiscalChain(@ConnectedSocket() client: Socket) {
    try {
      const audit = await this.closingService.verifyFiscalChainIntegrity();
      await this.journal.log("AUDIT_RUN", { staffId: client.data.user.staffId, name: client.data.user.name }, { status: audit.status, errors: audit.errors.length });
      return { ok: true, audit };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.fec")
  @SubscribeMessage("closing:get_fec")
  async handleGetFecExport(@ConnectedSocket() client: Socket, @MessageBody() data?: any) {
    try {
      const fec = await this.closingService.generateFecExport(data || {});
      if (data?.download) {
        await this.journal.log("FEC_EXPORT", { staffId: client.data.user.staffId, name: client.data.user.name }, { fileName: fec.fileName, startDate: data.startDate, endDate: data.endDate });
      }
      return { ok: true, fec };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // ── Avoirs & Journal des événements (NF525) ─────────────────────────

  @RequirePermissions("caisse.close")
  @SubscribeMessage("history:refund")
  async handleRefund(@ConnectedSocket() client: Socket, @MessageBody() data: { historyId: string; reason: string }) {
    try {
      const creditNote = await this.billingService.refundTicket(data?.historyId, data?.reason, client.data.user.name);
      this.server.emit("history:new_entry", creditNote);
      await this.journal.log("CREDIT_NOTE", { staffId: client.data.user.staffId, name: client.data.user.name }, {
        ticketNumber: creditNote.ticketNumber,
        refTicketNumber: creditNote.refTicketNumber,
        total: creditNote.total,
        reason: creditNote.reason,
      });
      return { ok: true, history: creditNote };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("caisse.fec", "caisse.close")
  @SubscribeMessage("journal:list")
  async handleJournalList(@MessageBody() data?: { limit?: number }) {
    try {
      return { ok: true, events: await this.journal.list(Math.min(Number(data?.limit) || 200, 1000)) };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}
