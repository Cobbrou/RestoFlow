import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { PIN, SessionPayload } from "../auth/auth.service";
import { normalizeHours } from "../catalog/catalog.service";
import { toCents } from "../billing/pricing";
import { distributeTips, TipsOptions } from "./tips";

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const clientId = (id: any, prefix: string) => (typeof id === "string" && /^[\w-]{3,64}$/.test(id) ? id : newId(prefix));

export type Actor = Pick<SessionPayload, "staffId" | "roleId" | "permissions">;

/**
 * Anti-escalade : seul un admin attribue le rôle admin ou touche à un compte admin,
 * et personne ne donne (via un rôle) une permission qu'il n'a pas lui-même
 */
export function assertCanGrant(actor: Actor, roleId: string | null, permissions: string[] = []) {
  if (actor.roleId === "admin") return;
  if (roleId === "admin") throw new ForbiddenException("Seul un administrateur peut gérer un compte administrateur");
  const missing = permissions.filter((p) => !(actor.permissions || []).includes(p));
  if (missing.length > 0) throw new ForbiddenException(`Vous ne pouvez pas attribuer des droits que vous n'avez pas : ${missing.join(", ")}`);
}

/**
 * Administration persistée côté serveur : plan de salle, formules, équipe et rôles.
 * Chaque mutation renvoie la liste complète, diffusée à tous les terminaux.
 */
@Injectable()
export class ManagementService {
  constructor(private prisma: PrismaService) {}

  // ── Tables ───────────────────────────────────────────────────────────

  listTables() {
    return this.prisma.table.findMany({ orderBy: { number: "asc" } });
  }

  async createTable(data: any) {
    const number = Number(data?.number);
    const seats = Number(data?.seats);
    if (!Number.isInteger(number) || number < 1) throw new BadRequestException("Numéro de table invalide");
    if (!Number.isInteger(seats) || seats < 1) throw new BadRequestException("Nombre de couverts invalide");
    if (await this.prisma.table.findUnique({ where: { number } })) {
      throw new ConflictException(`La table n°${number} existe déjà`);
    }
    await this.prisma.table.create({
      data: { id: clientId(data.id, "tbl"), number, seats, x: Number(data.x) || 50, y: Number(data.y) || 50 },
    });
    return this.listTables();
  }

  async updateTable(id: string, data: any) {
    const patch: any = {};
    if (data?.number !== undefined) {
      const number = Number(data.number);
      if (!Number.isInteger(number) || number < 1) throw new BadRequestException("Numéro de table invalide");
      const other = await this.prisma.table.findUnique({ where: { number } });
      if (other && other.id !== id) throw new ConflictException(`La table n°${number} existe déjà`);
      patch.number = number;
    }
    if (data?.seats !== undefined) {
      const seats = Number(data.seats);
      if (!Number.isInteger(seats) || seats < 1) throw new BadRequestException("Nombre de couverts invalide");
      patch.seats = seats;
    }
    if (data?.x !== undefined) patch.x = Number(data.x) || 0;
    if (data?.y !== undefined) patch.y = Number(data.y) || 0;
    await this.prisma.table.update({ where: { id }, data: patch });
    return this.listTables();
  }

  async deleteTable(id: string) {
    await this.prisma.$transaction(async (tx) => {
      if (await tx.order.findFirst({ where: { tableId: id, status: "open" } })) {
        throw new ConflictException("Impossible de supprimer : commande en cours sur cette table");
      }
      // Les commandes encaissées ne sont que des brouillons opérationnels : le ticket fiscal est dans OrderHistory
      await tx.order.deleteMany({ where: { tableId: id } });
      await tx.reservation.updateMany({ where: { tableId: id }, data: { tableId: null } });
      await tx.table.delete({ where: { id } });
    });
    return this.listTables();
  }

  // ── Formules / menus ─────────────────────────────────────────────────

  async listMenus() {
    const menus = await this.prisma.menu.findMany();
    return menus.map((m) => ({ ...m, emoji: m.emoji || "📋", groups: JSON.parse(m.groups || "[]") }));
  }

  private menuFields(data: any) {
    const fields: any = {};
    if (data?.name !== undefined) {
      if (!String(data.name).trim()) throw new BadRequestException("Nom de formule obligatoire");
      fields.name = String(data.name).trim();
    }
    if (data?.price !== undefined) {
      const price = Number(data.price);
      if (!Number.isFinite(price) || price < 0) throw new BadRequestException("Prix de formule invalide");
      fields.price = Math.round(price * 100) / 100;
    }
    if (data?.desc !== undefined) fields.desc = String(data.desc);
    if (data?.emoji !== undefined) fields.emoji = data.emoji;
    if (data?.available !== undefined) fields.available = Boolean(data.available);
    if (data?.hours !== undefined) fields.hours = normalizeHours(data.hours);
    if (data?.groups !== undefined) {
      if (!Array.isArray(data.groups)) throw new BadRequestException("Étapes de formule invalides");
      fields.groups = JSON.stringify(data.groups);
    }
    return fields;
  }

  async createMenu(data: any) {
    const fields = this.menuFields({ desc: "", groups: [], ...data });
    if (fields.name === undefined || fields.price === undefined) {
      throw new BadRequestException("Nom et prix de formule obligatoires");
    }
    await this.prisma.menu.create({ data: { id: clientId(data.id, "menu"), ...fields } });
    return this.listMenus();
  }

  async updateMenu(id: string, data: any) {
    await this.prisma.menu.update({ where: { id }, data: this.menuFields(data) });
    return this.listMenus();
  }

  async deleteMenu(id: string) {
    await this.prisma.menu.delete({ where: { id } });
    return this.listMenus();
  }

  // ── Équipe ───────────────────────────────────────────────────────────

  listStaff() {
    return this.prisma.staff.findMany({
      select: { id: true, name: true, roleId: true, email: true, phone: true, active: true, avatarBg: true },
      orderBy: { name: "asc" },
    });
  }

  private async staffFields(data: any, creating: boolean, actor: Actor) {
    const fields: any = {};
    if (data?.name !== undefined || creating) {
      const name = String(data?.name || "").trim();
      if (!name) throw new BadRequestException("Nom du collaborateur obligatoire");
      fields.name = name;
    }
    if (data?.roleId !== undefined || creating) {
      const role = await this.prisma.role.findUnique({ where: { id: String(data?.roleId) } });
      if (!role) throw new BadRequestException("Rôle inconnu");
      assertCanGrant(actor, role.id, JSON.parse(role.permissions || "[]"));
      fields.roleId = data.roleId;
    }
    // PIN : jamais stocké ni renvoyé en clair ; vide en modification = inchangé
    if (data?.pin || creating) {
      if (!PIN.test(String(data?.pin || ""))) throw new BadRequestException("Le code PIN doit comporter 4 à 6 chiffres");
      fields.pin = await bcrypt.hash(String(data.pin), 10);
    }
    if (data?.email !== undefined) fields.email = data.email || null;
    if (data?.phone !== undefined) fields.phone = data.phone || null;
    if (data?.active !== undefined) fields.active = Boolean(data.active);
    if (data?.avatarBg !== undefined) fields.avatarBg = String(data.avatarBg);
    return fields;
  }

  async createStaff(data: any, actor: Actor) {
    const fields = await this.staffFields(data, true, actor);
    await this.prisma.staff.create({
      data: { id: clientId(data.id, "stf"), avatarBg: "#C1440E", ...fields },
    });
    return this.listStaff();
  }

  async updateStaff(id: string, data: any, actor: Actor) {
    const target = await this.prisma.staff.findUnique({ where: { id } });
    if (!target) throw new NotFoundException("Collaborateur introuvable");
    assertCanGrant(actor, target.roleId); // un compte admin (PIN, rôle…) n'est modifiable que par un admin
    const fields = await this.staffFields(data, false, actor);
    if (id === actor.staffId && (fields.active === false || (fields.roleId && fields.roleId !== "admin"))) {
      await this.assertAnotherActiveAdmin(id);
    }
    await this.prisma.staff.update({ where: { id }, data: fields });
    return this.listStaff();
  }

  async deleteStaff(id: string, actor: Actor) {
    if (id === actor.staffId) throw new BadRequestException("Vous ne pouvez pas supprimer votre propre compte");
    const target = await this.prisma.staff.findUnique({ where: { id } });
    if (!target) throw new NotFoundException("Collaborateur introuvable");
    assertCanGrant(actor, target.roleId);
    if (target.roleId === "admin") await this.assertAnotherActiveAdmin(id);
    await this.prisma.staff.delete({ where: { id } });
    return this.listStaff();
  }

  private async assertAnotherActiveAdmin(exceptId: string) {
    const admins = await this.prisma.staff.count({ where: { roleId: "admin", active: true, id: { not: exceptId } } });
    if (admins === 0) throw new BadRequestException("Il doit rester au moins un administrateur actif");
  }

  // ── Rôles ────────────────────────────────────────────────────────────

  async listRoles() {
    const roles = await this.prisma.role.findMany();
    return roles.map((r) => ({ ...r, permissions: JSON.parse(r.permissions || "[]") }));
  }

  private roleFields(data: any) {
    const fields: any = {};
    if (data?.name !== undefined) {
      if (!String(data.name).trim()) throw new BadRequestException("Nom du rôle obligatoire");
      fields.name = String(data.name).trim();
    }
    if (data?.description !== undefined) fields.description = String(data.description);
    if (data?.color !== undefined) fields.color = String(data.color);
    if (data?.permissions !== undefined) {
      if (!Array.isArray(data.permissions) || !data.permissions.every((p: any) => typeof p === "string")) {
        throw new BadRequestException("Permissions invalides");
      }
      fields.permissions = JSON.stringify(data.permissions);
    }
    return fields;
  }

  async createRole(data: any, actor: Actor) {
    const fields = this.roleFields({ description: "", color: "#8A8378", permissions: [], ...data });
    assertCanGrant(actor, null, JSON.parse(fields.permissions));
    if (!fields.name) throw new BadRequestException("Nom du rôle obligatoire");
    await this.prisma.role.create({ data: { id: clientId(data.id, "role"), isSystem: false, ...fields } });
    return this.listRoles();
  }

  async updateRole(id: string, data: any, actor: Actor) {
    if (id === "admin") throw new BadRequestException("Le rôle administrateur n'est pas modifiable");
    const fields = this.roleFields(data);
    if (fields.permissions) assertCanGrant(actor, null, JSON.parse(fields.permissions));
    await this.prisma.role.update({ where: { id }, data: fields });
    return this.listRoles();
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Rôle introuvable");
    if (role.isSystem) throw new BadRequestException("Un rôle système ne peut pas être supprimé");
    if (await this.prisma.staff.count({ where: { roleId: id } })) {
      throw new ConflictException("Ce rôle est encore attribué à des collaborateurs");
    }
    await this.prisma.role.delete({ where: { id } });
    return this.listRoles();
  }

  // ── Pointage ─────────────────────────────────────────────────────────

  /** Services en cours (tous équipiers) : diffusés pour afficher qui est en poste */
  listOpenShifts() {
    return this.prisma.shift.findMany({ where: { endAt: null }, orderBy: { startAt: "asc" } });
  }

  /** Services commencés sur la période [from, to[ ; ceux encore ouverts y figurent aussi */
  listShifts(from: Date, to: Date) {
    return this.prisma.shift.findMany({
      where: { OR: [{ startAt: { gte: from, lt: to } }, { endAt: null }] },
      orderBy: { startAt: "asc" },
    });
  }

  /**
   * Arrivée ou départ d'un équipier. Rejouable hors-ligne : l'heure saisie sur la tablette fait foi
   * (bornée aux dernières 24 h), une arrivée déjà en cours ou un départ sans service ouvert ne change rien.
   */
  async clock(data: { id?: string; staffId: string; action: string; at?: number }) {
    const staff = await this.prisma.staff.findUnique({ where: { id: data.staffId }, select: { id: true, active: true } });
    if (!staff?.active) throw new NotFoundException("Équipier introuvable ou inactif");
    const now = Date.now();
    const at = new Date(Number.isFinite(Number(data.at)) && Number(data.at) <= now && Number(data.at) > now - 86400000 ? Number(data.at) : now);
    const open = await this.prisma.shift.findFirst({ where: { staffId: staff.id, endAt: null } });

    if (data.action === "in") {
      // ponytail: deux arrivées simultanées depuis deux tablettes peuvent ouvrir deux services ; index unique partiel (staffId où endAt IS NULL) si cela arrive
      if (open) return open;
      const id = clientId(data.id, "shift");
      return (await this.prisma.shift.findUnique({ where: { id } })) ?? this.prisma.shift.create({ data: { id, staffId: staff.id, startAt: at } });
    }
    if (data.action === "out") {
      if (!open) return null;
      return this.prisma.shift.update({ where: { id: open.id }, data: { endAt: at < open.startAt ? open.startAt : at } });
    }
    throw new BadRequestException("Pointage : action « in » ou « out » attendue");
  }

  /** Départ oublié : le gestionnaire saisit l'heure réelle de fin */
  async closeShift(id: string, endAt: number, closedBy: string) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException("Service introuvable");
    if (shift.endAt) return shift;
    const end = new Date(Number(endAt));
    if (!Number.isFinite(end.getTime()) || end <= shift.startAt || end.getTime() > Date.now()) {
      throw new BadRequestException("Heure de fin invalide (après l'arrivée, pas dans le futur)");
    }
    return this.prisma.shift.update({ where: { id }, data: { endAt: end, closedBy } });
  }

  /**
   * Répartition des pourboires encaissés sur [from, to[ (avoirs déduits) selon les heures pointées.
   * extraCents : montant ajouté à la main (tronc commun en espèces, par exemple).
   */
  async tipsDistribution(from: Date, to: Date, options: TipsOptions & { extraCents?: number } = {}) {
    if (!(to > from)) throw new BadRequestException("Période invalide");
    const mode = options.mode ?? "hours";
    if (!["hours", "weighted", "equal"].includes(mode)) throw new BadRequestException("Mode de répartition inconnu");
    const extraCents = Math.round(Number(options.extraCents) || 0);
    if (extraCents < 0) throw new BadRequestException("Montant ajouté invalide");

    const [tickets, shifts, staff] = await Promise.all([
      this.prisma.orderHistory.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { tip: true } }),
      this.prisma.shift.findMany({ where: { startAt: { lt: to }, OR: [{ endAt: null }, { endAt: { gt: from } }] } }),
      this.prisma.staff.findMany({ select: { id: true, name: true, roleId: true } }),
    ]);
    const collectedCents = tickets.reduce((sum, t) => sum + toCents(t.tip ?? 0), 0);
    const tipCents = Math.max(0, collectedCents) + extraCents;
    const roleWeights = Object.fromEntries(
      Object.entries(options.roleWeights ?? {}).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) >= 0).map(([k, v]) => [k, Number(v)])
    );
    return {
      collectedCents,
      extraCents,
      ...distributeTips(tipCents, shifts, staff, { from: from.getTime(), to: to.getTime() }, {
        mode,
        roleWeights,
        excludedRoleIds: Array.isArray(options.excludedRoleIds) ? options.excludedRoleIds : [],
        excludedStaffIds: Array.isArray(options.excludedStaffIds) ? options.excludedStaffIds : [],
      }),
    };
  }
}
