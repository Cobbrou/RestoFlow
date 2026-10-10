import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { effectivePrice, normalizeOptionGroups, resolveOptions, toCents, toEuros, OptionPick } from "../billing/pricing";

// Tolérance sur l'horodatage client d'un ajout rejoué depuis la file hors-ligne
const MAX_OFFLINE_AGE_MS = 12 * 3600 * 1000;

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  formatOrder(order: any) {
    if (!order) return null;
    return {
      id: order.id,
      tableId: order.tableId,
      server: order.server,
      createdAt: order.createdAt ? new Date(order.createdAt).getTime() : Date.now(),
      sentAt: order.sentAt ? new Date(order.sentAt).getTime() : null,
      status: order.status,
      discount: order.discount ? (typeof order.discount === "string" ? JSON.parse(order.discount) : order.discount) : null,
      table: order.table ? {
        id: order.table.id,
        number: order.table.number,
        seats: order.table.seats,
        reserved: order.table.reserved,
        alert: order.table.alert,
      } : undefined,
      items: (order.items || []).map((it: any) => ({
        id: it.id,
        productId: it.productId,
        name: it.name,
        price: it.price,
        qty: it.qty,
        notes: it.notes || "",
        status: it.status,
        isMenu: it.isMenu,
        composition: it.composition ? (typeof it.composition === "string" ? JSON.parse(it.composition) : it.composition) : null,
        course: it.course || "direct",
        courseStatus: it.courseStatus || "direct",
        station: it.station || "kitchen",
        vatRate: it.vatRate ?? 10,
        options: it.options || "",
      })),
    };
  }

  async findActive() {
    const rawOrders = await this.prisma.order.findMany({
      where: { status: "open" },
      include: { items: true, table: true },
    });
    return rawOrders.map((o) => this.formatOrder(o));
  }

  async findHistory(limit = 100) {
    return this.prisma.orderHistory.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    return this.formatOrder(order);
  }

  async createOrEnsure(tableId: string, serverName = "Service", orderId?: string) {
    let table = await this.prisma.table.findUnique({ where: { id: tableId } });
    if (!table) {
      const num = parseInt(tableId.replace("tbl_", ""), 10);
      if (!isNaN(num)) {
        table = await this.prisma.table.findUnique({ where: { number: num } });
      }
    }
    if (!table) throw new NotFoundException("Table introuvable");

    const resolvedTableId = table.id;

    let order = null;
    if (orderId) {
      order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, table: true },
      });
    }

    if (!order) {
      order = await this.prisma.order.findFirst({
        where: { tableId: resolvedTableId, status: "open" },
        include: { items: true, table: true },
      });
    }

    if (!order) {
      order = await this.prisma.order.create({
        data: {
          id: orderId || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          tableId: resolvedTableId,
          server: serverName || "Service",
          status: "open",
        },
        include: { items: true, table: true },
      });
    }

    return this.formatOrder(order);
  }

  async addItem(data: {
    orderId: string;
    product: { id: string; name: string; price: number; isMenu?: boolean; cat?: string; station?: string };
    composition?: any;
    course?: string;
    courseStatus?: string;
    station?: string;
    addedAt?: number;
    itemId?: string;
    tableId?: string;
    options?: OptionPick[];
  }) {
    // La commande doit exister (order:create_or_ensure précède toujours, file hors-ligne ordonnée).
    // Table ouverte hors-ligne sur deux terminaux : la commande du terminal arrivé second n'existe pas,
    // ses articles rejoignent la commande ouverte de la même table.
    const order =
      (await this.prisma.order.findUnique({ where: { id: data.orderId }, include: { items: true } })) ||
      (data.tableId
        ? await this.prisma.order.findFirst({ where: { tableId: data.tableId, status: "open" }, include: { items: true } })
        : null);
    if (!order || order.status !== "open") throw new NotFoundException("Commande introuvable ou déjà encaissée");

    // Identifiant de ligne choisi par le terminal : les actions hors-ligne suivantes (quantité, note) le référencent
    const newItemId =
      typeof data.itemId === "string" && /^[\w-]{3,64}$/.test(data.itemId)
        ? data.itemId
        : `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 🔒 Prix, nom et taux de TVA viennent toujours de la base, jamais du client
    const { dbProduct, name, price: basePrice, vatRate } = await this.resolveCatalogPrice(data.product?.id, data.addedAt);

    // Options (cuisson, suppléments) validées contre la fiche produit ; le supplément s'ajoute au prix de la ligne
    let optionsLabel = "";
    let price = basePrice;
    if (dbProduct) {
      try {
        const resolved = resolveOptions(normalizeOptionGroups(JSON.parse(dbProduct.options || "[]")), data.options);
        optionsLabel = resolved.label;
        price = toEuros(toCents(basePrice) + resolved.extraCents);
      } catch (e: any) {
        throw new BadRequestException(e.message);
      }
    }

    const cat = data.product?.cat || dbProduct?.cat || "";
    const isBar =
      cat === "boissons" ||
      data.product?.station === "bar" ||
      dbProduct?.station === "bar" ||
      data.station === "bar";

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
        (i: any) =>
          i.productId === data.product.id &&
          i.status === "draft" &&
          !i.notes &&
          (i.options || "") === optionsLabel &&
          (i.course || "direct") === course &&
          i.price === price
      );
      if (existing) {
        await this.prisma.orderItem.update({
          where: { id: existing.id },
          data: { qty: existing.qty + 1 },
        });
      } else {
        await this.prisma.orderItem.create({
          data: {
            id: newItemId,
            orderId: order.id,
            productId: data.product.id,
            name,
            price,
            vatRate,
            qty: 1,
            notes: "",
            options: optionsLabel || null,
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
          id: newItemId,
          orderId: order.id,
          productId: data.product.id,
          name,
          price,
          vatRate,
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
      where: { id: order.id },
      include: { items: true, table: true },
    });
    return this.formatOrder(updated);
  }

  /**
   * Prix de référence d'un produit ou d'un menu ("menu_<id>"), Happy Hour inclus.
   * Pour une action rejouée depuis la file hors-ligne, le Happy Hour est évalué à l'heure de l'ajout.
   */
  private async resolveCatalogPrice(productId?: string, addedAt?: number) {
    if (!productId) throw new BadRequestException("Produit manquant");
    const now = Date.now();
    const at = addedAt && addedAt <= now && now - addedAt < MAX_OFFLINE_AGE_MS ? new Date(addedAt) : new Date(now);

    if (productId.startsWith("menu_")) {
      const menu = await this.prisma.menu.findUnique({ where: { id: productId.slice(5) } });
      if (!menu) throw new NotFoundException("Menu introuvable");
      // ponytail: menu facturé à 10 % en bloc, ventiler par composant si un menu inclut de l'alcool
      return { dbProduct: null, name: menu.name, price: menu.price, vatRate: 10 };
    }

    const dbProduct = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!dbProduct) throw new NotFoundException("Produit introuvable");
    const cfg = await this.prisma.restaurantConfig.findUnique({
      where: { id: "default" },
      select: { happyHourConfig: true },
    });
    const hh = cfg?.happyHourConfig ? JSON.parse(cfg.happyHourConfig) : null;
    return { dbProduct, name: dbProduct.name, price: effectivePrice(dbProduct, hh, at), vatRate: dbProduct.vatRate };
  }

  async changeQty(orderId: string, itemId: string, delta: number) {
    const item = await this.prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Article non trouvé");
    if (item.status !== 'draft') {
      throw new BadRequestException(`Impossible de modifier un article en statut "${item.status}". Seuls les articles brouillons peuvent être modifiés.`);
    }

    const newQty = item.qty + delta;
    if (newQty <= 0) {
      await this.prisma.orderItem.delete({ where: { id: itemId } });
    } else {
      await this.prisma.orderItem.update({
        where: { id: itemId },
        data: { qty: newQty },
      });
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    return this.formatOrder(updated);
  }

  async removeItem(orderId: string, itemId: string) {
    const item = await this.prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Article introuvable');
    if (item.status !== 'draft') {
      throw new BadRequestException(`Impossible de supprimer un article en statut "${item.status}". Seuls les articles brouillons peuvent être supprimés.`);
    }
    await this.prisma.orderItem.delete({ where: { id: itemId } });
    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    return this.formatOrder(updated);
  }

  /**
   * Annulation d'un article déjà envoyé en cuisine (motif journalisé par l'appelant).
   * La ligne est supprimée ou sa quantité réduite : un article annulé n'est jamais facturé.
   */
  async voidItem(orderId: string, itemId: string, qty?: number) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { order: { include: { table: true } } },
    });
    if (!item || item.orderId !== orderId) throw new NotFoundException("Article introuvable");
    if (item.order.status !== "open") throw new BadRequestException("Commande déjà encaissée : émettez un avoir");
    if (item.status === "draft") throw new BadRequestException("Article non envoyé : supprimez-le directement");

    const voidQty = qty === undefined || qty === null ? item.qty : Number(qty);
    if (!Number.isInteger(voidQty) || voidQty < 1 || voidQty > item.qty) {
      throw new BadRequestException("Quantité à annuler invalide");
    }

    if (voidQty === item.qty) {
      await this.prisma.orderItem.delete({ where: { id: itemId } });
    } else {
      await this.prisma.orderItem.update({ where: { id: itemId }, data: { qty: item.qty - voidQty } });
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    return { order: this.formatOrder(updated), item, voidQty, tableNumber: item.order.table?.number };
  }

  async setNote(orderId: string, itemId: string, note: string) {
    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { notes: note },
    });
    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    return this.formatOrder(updated);
  }

  async sendKitchen(orderId: string, serverName?: string) {
    let order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    if (!order) {
      throw new NotFoundException(`Commande introuvable : ${orderId}`);
    }

    const now = new Date();
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        sentAt: now,
        server: serverName ? serverName : undefined,
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

    return {
      order: this.formatOrder(updated),
      rawOrder: order,
    };
  }

  async startPrep(orderId: string, station?: string) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new NotFoundException("Commande introuvable");

    const whereClause: any = { orderId, status: "new", courseStatus: { not: "held" } };
    if (station && station !== "all") {
      whereClause.station = station;
    }

    await this.prisma.orderItem.updateMany({
      where: whereClause,
      data: { status: "preparing" },
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    return this.formatOrder(updated);
  }

  async markReady(orderId: string, station?: string) {
    const existing = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    if (!existing) throw new NotFoundException("Commande introuvable");

    const whereClause: any = { orderId, status: "preparing", courseStatus: { not: "held" } };
    if (station && station !== "all") {
      whereClause.station = station;
    }

    await this.prisma.orderItem.updateMany({
      where: whereClause,
      data: { status: "ready" },
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    return this.formatOrder(updated);
  }

  async serve(orderId: string, course?: string) {
    const existing = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new NotFoundException("Commande introuvable");

    const whereClause: any = { orderId, status: "ready" };
    if (course) {
      whereClause.course = course;
    }

    await this.prisma.orderItem.updateMany({
      where: whereClause,
      data: { status: "served" },
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    return this.formatOrder(updated);
  }

  async callCourse(orderId: string, course: string, _serverName?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true },
    });
    if (!order) throw new NotFoundException("Commande introuvable");

    const heldItems = order.items.filter(
      (i: any) =>
        (course === "suite" || i.course === course) &&
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
      where: { id: orderId },
      include: { items: true, table: true },
    });

    return {
      order: this.formatOrder(updated),
      calledCount: heldItems.length,
      rawOrder: order,
    };
  }

  async changeItemCourse(itemId: string, course: string, courseStatus?: string) {
    const item = await this.prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Article introuvable");

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        course,
        courseStatus: courseStatus || (course === "entree" || course === "boisson" || course === "direct" ? "direct" : "held"),
      },
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: item.orderId },
      include: { items: true, table: true },
    });
    return this.formatOrder(updated);
  }
}
