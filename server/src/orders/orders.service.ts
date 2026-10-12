import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { effectivePrice, menuVatSplit, normalizeOptionGroups, resolveOptions, toCents, toEuros, OptionPick } from "../billing/pricing";

const COURSE_RANK: Record<string, number> = { entree: 1, plat: 2, dessert: 3 };

/**
 * Brouillons « en attente de réclame » à libérer dès l'envoi (copie de heldToRelease, src/utils/index.js) :
 * aucune suite antérieure n'est encore à servir dans la commande, ou le cadencement est désactivé.
 */
export function heldToRelease(
  items: { id: string; status: string; course?: string | null; courseStatus?: string | null }[],
  pacingEnabled: boolean
): string[] {
  return items
    .filter((i) => i.status === "draft" && i.courseStatus === "held")
    .filter((i) => {
      if (!pacingEnabled) return true;
      const rank = COURSE_RANK[i.course || ""] ?? 0;
      return !items.some((o) => o.status !== "served" && (COURSE_RANK[o.course || ""] ?? rank) < rank);
    })
    .map((i) => i.id);
}

/**
 * Modes de service hors salle et module qui les active. La livraison (plateformes, site) s'ajoutera ici
 * avec son propre module ; les canaux externes créeront leurs commandes via createOffPremise.
 */
// null : mode toujours disponible (vente comptoir : bar, café, sans envoi en cuisine)
export const OFF_PREMISE_MODULES: Record<string, string | null> = { takeaway: "enableTakeaway", counter: null };
// Canaux saisis depuis la caisse ; "online" et les plateformes arriveront par leurs propres intégrations
const POS_CHANNELS = ["pos", "phone"];

export const isOffPremise = (order: { type?: string | null }) => !!order.type && order.type !== "dine_in";

/** Libellé d'une commande pour les bons, toasts et tickets : "Table 4" ou "Emporter #12 · Dupont" */
export function orderLabel(order: any): string {
  if (!isOffPremise(order)) return `Table ${order.table?.number ?? "?"}`;
  const kind = order.type === "takeaway" ? "Emporter" : order.type === "counter" ? "Comptoir" : "Livraison";
  return [`${kind} #${order.pickupNumber ?? "?"}`, order.customerName].filter(Boolean).join(" · ");
}

// Tolérance sur l'horodatage client d'un ajout rejoué depuis la file hors-ligne
const MAX_OFFLINE_AGE_MS = 12 * 3600 * 1000;

// Couverts : entier de 1 à 99, sinon non renseigné
const validCovers = (n: unknown): number | null =>
  typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;

/**
 * Composition d'un menu envoyée par le terminal : une entrée par étape de la formule, dans l'ordre,
 * avec exactement `count` produits proposés par cette étape. Renvoie les étapes de la formule.
 */
export function checkMenuComposition(groups: any[], composition: unknown) {
  if (!Array.isArray(groups) || !Array.isArray(composition) || composition.length !== groups.length) {
    throw new BadRequestException("Composition du menu incomplète");
  }
  groups.forEach((g, i) => {
    const ids = (composition[i] as any)?.productIds;
    const allowed: string[] = Array.isArray(g?.productIds) ? g.productIds : [];
    if (!Array.isArray(ids) || ids.length !== (Number(g?.count) || 1) || !ids.every((id) => allowed.includes(id))) {
      throw new BadRequestException(`${g?.title || "Menu"} : choix invalide`);
    }
  });
  return groups;
}

// Ouvertures de table sérialisées par table : deux terminaux qui ouvrent la même table au même instant
// obtiennent la même commande, jamais deux commandes ouvertes
// ponytail: verrou en mémoire mono-processus, index unique partiel en base si plusieurs instances serveur
const tableLocks = new Map<string, Promise<unknown>>();
function withTableLock<T>(tableId: string, fn: () => Promise<T>): Promise<T> {
  const run = (tableLocks.get(tableId) || Promise.resolve()).catch(() => {}).then(fn);
  tableLocks.set(tableId, run);
  run.finally(() => tableLocks.get(tableId) === run && tableLocks.delete(tableId)).catch(() => {});
  return run;
}

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
      type: order.type || "dine_in",
      channel: order.channel || "pos",
      customerName: order.customerName ?? null,
      customerPhone: order.customerPhone ?? null,
      pickupAt: order.pickupAt ? new Date(order.pickupAt).getTime() : null,
      pickupNumber: order.pickupNumber ?? null,
      covers: order.covers ?? null,
      billRequestedAt: order.billRequestedAt ? new Date(order.billRequestedAt).getTime() : null,
      paidTotal: order.paidTotal || 0,
      externalRef: order.externalRef ?? null,
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
        paidQty: it.paidQty || 0,
        notes: it.notes || "",
        status: it.status,
        isMenu: it.isMenu,
        composition: it.composition ? (typeof it.composition === "string" ? JSON.parse(it.composition) : it.composition) : null,
        course: it.course || "direct",
        courseStatus: it.courseStatus || "direct",
        station: it.station || "kitchen",
        vatRate: it.vatRate ?? 10,
        vatSplit: it.vatSplit ? (typeof it.vatSplit === "string" ? JSON.parse(it.vatSplit) : it.vatSplit) : null,
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

  async createOrEnsure(tableId: string, serverName = "Service", orderId?: string, covers?: number) {
    let table = await this.prisma.table.findUnique({ where: { id: tableId } });
    if (!table) {
      const num = parseInt(tableId.replace("tbl_", ""), 10);
      if (!isNaN(num)) {
        table = await this.prisma.table.findUnique({ where: { number: num } });
      }
    }
    if (!table) throw new NotFoundException("Table introuvable");

    const resolvedTableId = table.id;

    return withTableLock(resolvedTableId, async () => {
      // Seule une commande encore ouverte sur cette table est reprise (rejeu après encaissement, autre table : ignorée)
      const order =
        (await this.prisma.order.findFirst({
          where: { tableId: resolvedTableId, status: "open" },
          include: { items: true, table: true },
        })) ||
        (await this.prisma.order.create({
          data: {
            // Identifiant du terminal réutilisé seulement s'il est libre
            id:
              orderId && !(await this.prisma.order.findUnique({ where: { id: orderId } }))
                ? orderId
                : `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            tableId: resolvedTableId,
            server: serverName || "Service",
            status: "open",
            covers: validCovers(covers),
          },
          include: { items: true, table: true },
        }));
      return this.formatOrder(order);
    });
  }

  /**
   * Annulation d'une commande hors salle (emporter, comptoir) créée par erreur.
   * Seulement si rien n'est parti en cuisine ni encaissé : sinon, annuler d'abord les articles envoyés (avec motif).
   * La commande est conservée en statut "cancelled" (trace), jamais supprimée.
   */
  async cancelOffPremise(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true, table: true } });
    if (!order) throw new NotFoundException("Commande introuvable");
    if (order.status === "cancelled") return { order: this.formatOrder(order), label: orderLabel(order) }; // rejeu
    if (!isOffPremise(order)) throw new BadRequestException("Seule une commande à emporter ou comptoir peut être annulée");
    if (order.status !== "open") throw new BadRequestException("Commande déjà encaissée : émettez un avoir");
    if ((order.paidTotal || 0) > 0) throw new BadRequestException("Commande déjà en partie encaissée");
    if (order.items.some((i) => i.status !== "draft")) {
      throw new BadRequestException("Des articles sont partis en cuisine : annulez-les d'abord (avec motif)");
    }
    const res = await this.prisma.order.updateMany({ where: { id: orderId, status: "open" }, data: { status: "cancelled" } });
    if (res.count === 0) throw new BadRequestException("Commande déjà encaissée ou annulée");
    return { order: this.formatOrder({ ...order, status: "cancelled" }), label: orderLabel(order) };
  }

  /** Correction du nombre de couverts d'une commande ouverte */
  async setCovers(orderId: string, covers: number) {
    const value = validCovers(covers);
    if (value == null) throw new BadRequestException("Nombre de couverts invalide (1 à 99)");
    const res = await this.prisma.order.updateMany({ where: { id: orderId, status: "open" }, data: { covers: value } });
    if (res.count === 0) throw new NotFoundException("Commande introuvable ou déjà encaissée");
    return this.findById(orderId);
  }

  /** Addition demandée : valeur explicite (pas de bascule) pour qu'un rejeu hors-ligne reste idempotent */
  async setBillRequested(orderId: string, requested: boolean) {
    const res = await this.prisma.order.updateMany({
      where: { id: orderId, status: "open" },
      data: { billRequestedAt: requested ? new Date() : null },
    });
    if (res.count === 0) throw new NotFoundException("Commande introuvable ou déjà encaissée");
    return this.findById(orderId);
  }

  /**
   * Commande hors salle (emporter ; demain téléphone, site, plateformes). Rejouée hors-ligne avec le même
   * orderId : renvoie la commande existante. Refusée si le module du mode de service est coupé.
   */
  async createOffPremise(data: {
    orderId?: string;
    type: string;
    channel?: string;
    server?: string;
    customerName?: string;
    customerPhone?: string;
    pickupAt?: number | string | null;
  }) {
    const moduleKey = OFF_PREMISE_MODULES[data?.type];
    if (moduleKey === undefined) throw new BadRequestException("Mode de service inconnu");
    if (moduleKey) {
      const cfg = await this.prisma.restaurantConfig.findUnique({ where: { id: "default" }, select: { modulesConfig: true } });
      const modules = cfg?.modulesConfig ? JSON.parse(cfg.modulesConfig) : {};
      if (!modules[moduleKey]) throw new BadRequestException("Module désactivé dans la configuration");
    }

    const channel = data.channel || "pos";
    if (!POS_CHANNELS.includes(channel)) throw new BadRequestException("Canal de commande invalide");

    if (data.orderId) {
      const existing = await this.prisma.order.findUnique({ where: { id: data.orderId }, include: { items: true, table: true } });
      if (existing) return this.formatOrder(existing);
    }

    const pickupAt = data.pickupAt ? new Date(data.pickupAt) : null;
    if (pickupAt && isNaN(pickupAt.getTime())) throw new BadRequestException("Heure de retrait invalide");
    const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

    // Numéro d'appel remis à 1 chaque jour
    // ponytail: deux créations simultanées peuvent obtenir le même numéro (affichage seul), compteur atomique si gênant
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const last = await this.prisma.order.aggregate({
      where: { createdAt: { gte: startOfDay }, pickupNumber: { not: null } },
      _max: { pickupNumber: true },
    });

    const order = await this.prisma.order.create({
      data: {
        id: data.orderId || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: data.type,
        channel,
        server: data.server || "Service",
        status: "open",
        customerName: text(data.customerName, 60),
        customerPhone: text(data.customerPhone, 30),
        pickupAt,
        pickupNumber: (last._max.pickupNumber ?? 0) + 1,
      },
      include: { items: true, table: true },
    });
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
    const { dbProduct, menu, name, price: basePrice, vatRate } = await this.resolveCatalogPrice(data.product?.id, data.addedAt);

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
    let courseStatus = data.courseStatus || (course === "entree" || course === "boisson" || course === "direct" ? "direct" : "held");
    // Hors salle : tout part ensemble, pas de suites à réclamer
    if (isOffPremise(order)) course = courseStatus = "direct";

    // 🔒 Menu ou produit : déduit de l'identifiant en base, jamais du drapeau isMenu envoyé par le client
    if (!menu) {
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
      // Options des composants (cuisson du burger…) : composition[g].options[i] = picks de productIds[i]
      const groups = checkMenuComposition(JSON.parse(menu.groups || "[]"), data.composition);
      const parts: string[] = [];
      const components: { price: number; vatRate: number }[] = [];
      const composition: any[] = [];
      let extraCents = 0;
      for (const [gi, g] of (data.composition as any[]).entries()) {
        const ids: string[] = g.productIds;
        const names: string[] = [];
        for (const [i, pid] of ids.entries()) {
          const p = await this.prisma.product.findUnique({
            where: { id: pid },
            select: { name: true, options: true, price: true, vatRate: true },
          });
          if (!p) throw new BadRequestException(`${groups[gi].title || "Menu"} : produit introuvable`);
          components.push(p);
          names.push(p.name);
          try {
            const r = resolveOptions(normalizeOptionGroups(JSON.parse(p.options || "[]")), g.options?.[i]);
            extraCents += r.extraCents;
            if (r.label) parts.push(`${p.name} : ${r.label}`);
          } catch (e: any) {
            throw new BadRequestException(`${p.name} — ${e.message}`);
          }
        }
        // Libellés relus en base : le bon cuisine n'affiche que ce qui a été validé
        composition.push({ title: groups[gi].title, names, productIds: ids, options: ids.map((_, i) => g.options?.[i] || []) });
      }
      const split = menuVatSplit(components);
      await this.prisma.orderItem.create({
        data: {
          id: newItemId,
          orderId: order.id,
          productId: data.product.id,
          name,
          price: toEuros(toCents(price) + extraCents),
          // Menu à taux unique (tout à 10 %, ou tout à 20 %) : taux du composant ; menu mixte : ventilation au prorata
          vatRate: split ? vatRate : (components[0]?.vatRate ?? vatRate),
          vatSplit: split ? JSON.stringify(split) : null,
          qty: 1,
          notes: "",
          options: parts.join(" | ") || null,
          status: "draft",
          isMenu: true,
          composition: JSON.stringify(composition),
          course: isOffPremise(order) ? "direct" : data.course || "plat",
          courseStatus: isOffPremise(order) ? "direct" : data.courseStatus || "held",
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
      // Taux par défaut ; addItem le remplace par celui des composants (ou une ventilation si menu mixte)
      return { dbProduct: null, menu, name: menu.name, price: menu.price, vatRate: 10 };
    }

    const dbProduct = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!dbProduct) throw new NotFoundException("Produit introuvable");
    const cfg = await this.prisma.restaurantConfig.findUnique({
      where: { id: "default" },
      select: { happyHourConfig: true },
    });
    const hh = cfg?.happyHourConfig ? JSON.parse(cfg.happyHourConfig) : null;
    return { dbProduct, menu: null, name: dbProduct.name, price: effectivePrice(dbProduct, hh, at), vatRate: dbProduct.vatRate };
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
    // Une part déjà encaissée sur un ticket de convive ne s'annule plus que par un avoir
    if (voidQty > item.qty - (item.paidQty || 0)) {
      throw new BadRequestException("Quantité déjà encaissée sur un ticket : émettez un avoir");
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
    return { order: this.formatOrder(updated), item, voidQty, tableNumber: item.order.table?.number, label: orderLabel(item.order) };
  }

  async setNote(orderId: string, itemId: string, note: string) {
    const item = await this.prisma.orderItem.findFirst({ where: { id: itemId, orderId } });
    if (!item) throw new NotFoundException("Article introuvable");
    // Rejeu idempotent : même note, rien à faire
    if (item.status !== "draft" && (item.notes || "") !== (note || "")) {
      throw new BadRequestException("Article déjà envoyé en cuisine : la note ne peut plus être modifiée");
    }
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
    if (order.status !== "open") throw new BadRequestException("Commande déjà encaissée ou annulée");

    // Une suite n'attend la réclame que si une suite précédente reste à servir (ex. burger seul : envoi direct)
    const cfg = await this.prisma.restaurantConfig.findUnique({ where: { id: "default" }, select: { modulesConfig: true } });
    const pacingEnabled = (cfg?.modulesConfig ? JSON.parse(cfg.modulesConfig) : {}).enableCoursePacing ?? true;
    const released = heldToRelease(order.items, pacingEnabled);
    if (released.length > 0) {
      await this.prisma.orderItem.updateMany({ where: { id: { in: released } }, data: { courseStatus: "direct" } });
    }

    const now = new Date();
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        sentAt: now,
        server: serverName ? serverName : undefined,
      },
    });

    // 🔒 Passage conditionnel ligne par ligne : deux envois simultanés (double appui, deux terminaux)
    // ne réclament jamais la même ligne ; seules les lignes réellement envoyées ici sont déstockées et imprimées
    const sentIds: string[] = [];
    for (const item of order.items.filter((i) => i.status === "draft")) {
      const res = await this.prisma.orderItem.updateMany({ where: { id: item.id, status: "draft" }, data: { status: "new" } });
      if (res.count === 1) sentIds.push(item.id);
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, table: true },
    });

    return {
      order: this.formatOrder(updated),
      rawOrder: order,
      sentIds,
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

    // Seules les suites déjà envoyées (et déstockées) sont réclamées ; un brouillon part par l'envoi en cuisine
    const heldItems = order.items.filter(
      (i: any) =>
        (course === "suite" || i.course === course) &&
        i.courseStatus === "held" &&
        i.status !== "draft"
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
      calledIds: heldItems.map((i) => i.id),
      rawOrder: order,
    };
  }

  async changeItemCourse(itemId: string, course: string, courseStatus?: string) {
    const item = await this.prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Article introuvable");
    if (item.status !== "draft") {
      // Rejeu idempotent (même suite) accepté sans rien modifier
      if (item.course !== course) {
        throw new BadRequestException("Article déjà envoyé en cuisine : la suite ne peut plus être modifiée");
      }
    } else {
      await this.prisma.orderItem.update({
        where: { id: itemId },
        data: {
          course,
          courseStatus: courseStatus || (course === "entree" || course === "boisson" || course === "direct" ? "direct" : "held"),
        },
      });
    }

    const updated = await this.prisma.order.findUnique({
      where: { id: item.orderId },
      include: { items: true, table: true },
    });
    return this.formatOrder(updated);
  }
}
