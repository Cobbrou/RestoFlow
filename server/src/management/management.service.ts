import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { SessionPayload } from "../auth/auth.service";

const PIN = /^\d{4,6}$/;
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
}
