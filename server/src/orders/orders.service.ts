import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
    if (!table) {
      throw new NotFoundException(`Table introuvable : ${tableId}`);
    }

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
  }) {
    let order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Commande introuvable : ${data.orderId}`);
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
      include: { items: true, table: true },
    });
    return this.formatOrder(updated);
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
