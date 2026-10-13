import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from "@nestjs/websockets";
import { UseGuards, UseInterceptors } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { WsAuthGuard, STAFF_ROOM, SENSITIVE, authenticateSocket, permRooms, hasAnyPermission } from "../auth/guards/ws-auth.guard";
import { ScalarIdsGuard } from "../auth/guards/scalar-ids.guard";
import { AuthService, SESSION_MS } from "../auth/auth.service";
import { WsPermissionsGuard } from "../auth/guards/ws-permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { ClientActionInterceptor } from "../websocket/client-action.interceptor";
import { JournalService } from "../journal/journal.service";
import { ALLOWED_ORIGINS } from "../cors";
import { ManagementService } from "./management.service";

/**
 * Back-office temps réel : chaque mutation diffuse la liste complète à jour
 * (tables:list, menus:list, staff:list, roles:list) à tous les terminaux.
 */
@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS } })
@UseGuards(ScalarIdsGuard, WsAuthGuard, WsPermissionsGuard)
@UseInterceptors(ClientActionInterceptor)
export class ManagementGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private management: ManagementService,
    private journal: JournalService,
    private authService: AuthService
  ) {}

  private async broadcast(event: string, mutation: () => Promise<any>) {
    try {
      const list = await mutation();
      // Équipe ou rôles modifiés : droits relus pour chaque poste connecté, un compte désactivé sort de la room
      if (event === "staff:list" || event === "roles:list") {
        for (const s of await this.server.in(STAFF_ROOM).fetchSockets()) {
          if (!(await authenticateSocket(s as any, this.authService))) s.emit("auth:required");
        }
      }
      if (event === "staff:list") {
        // Coordonnées (e-mail, téléphone) réservées aux gestionnaires de l'équipe
        const managers = permRooms(SENSITIVE.staffContacts);
        this.server.to(managers).emit(event, list);
        this.server.to(STAFF_ROOM).except(managers).emit(event, list.map(({ email: _e, phone: _p, ...s }: any) => s));
      } else {
        this.server.to(STAFF_ROOM).emit(event, list);
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  // ── Tables ──
  @RequirePermissions("gestion.tables")
  @SubscribeMessage("table:create")
  createTable(@MessageBody() data: any) {
    return this.broadcast("tables:list", () => this.management.createTable(data));
  }

  @RequirePermissions("gestion.tables")
  @SubscribeMessage("table:update")
  updateTable(@MessageBody() data: { id: string; data: any }) {
    return this.broadcast("tables:list", () => this.management.updateTable(data?.id, data?.data));
  }

  @RequirePermissions("gestion.tables")
  @SubscribeMessage("table:delete")
  deleteTable(@MessageBody() data: { id: string }) {
    return this.broadcast("tables:list", () => this.management.deleteTable(data?.id));
  }

  // ── Formules ──
  @RequirePermissions("gestion.menus")
  @SubscribeMessage("menu:create")
  createMenu(@MessageBody() data: any) {
    return this.broadcast("menus:list", () => this.management.createMenu(data));
  }

  @RequirePermissions("gestion.menus")
  @SubscribeMessage("menu:update")
  updateMenu(@MessageBody() data: { id: string; data: any }) {
    return this.broadcast("menus:list", () => this.management.updateMenu(data?.id, data?.data));
  }

  @RequirePermissions("gestion.menus")
  @SubscribeMessage("menu:delete")
  deleteMenu(@MessageBody() data: { id: string }) {
    return this.broadcast("menus:list", () => this.management.deleteMenu(data?.id));
  }

  // ── Équipe (tracé dans le JET) ──
  @RequirePermissions("gestion.staff")
  @SubscribeMessage("staff:create")
  async createStaff(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const res = await this.broadcast("staff:list", () => this.management.createStaff(data, client.data.user));
    if (res.ok) await this.journal.log("STAFF_CREATE", this.actor(client), { name: data?.name, roleId: data?.roleId });
    return res;
  }

  @RequirePermissions("gestion.staff")
  @SubscribeMessage("staff:update")
  async updateStaff(@ConnectedSocket() client: Socket, @MessageBody() data: { id: string; data: any }) {
    const res = await this.broadcast("staff:list", () =>
      this.management.updateStaff(data?.id, data?.data, client.data.user)
    );
    if (res.ok) {
      const { pin, ...changes } = data?.data || {};
      await this.journal.log("STAFF_UPDATE", this.actor(client), { staffId: data?.id, changes, pinChanged: Boolean(pin) });
    }
    return res;
  }

  @RequirePermissions("gestion.staff")
  @SubscribeMessage("staff:delete")
  async deleteStaff(@ConnectedSocket() client: Socket, @MessageBody() data: { id: string }) {
    const res = await this.broadcast("staff:list", () => this.management.deleteStaff(data?.id, client.data.user));
    if (res.ok) await this.journal.log("STAFF_DELETE", this.actor(client), { staffId: data?.id });
    return res;
  }

  // ── Rôles (tracé dans le JET) ──
  @RequirePermissions("gestion.staff")
  @SubscribeMessage("role:create")
  async createRole(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const res = await this.broadcast("roles:list", () => this.management.createRole(data, client.data.user));
    if (res.ok) await this.journal.log("ROLE_CREATE", this.actor(client), { name: data?.name, permissions: data?.permissions });
    return res;
  }

  @RequirePermissions("gestion.staff")
  @SubscribeMessage("role:update")
  async updateRole(@ConnectedSocket() client: Socket, @MessageBody() data: { id: string; data: any }) {
    const res = await this.broadcast("roles:list", () => this.management.updateRole(data?.id, data?.data, client.data.user));
    if (res.ok) await this.journal.log("ROLE_UPDATE", this.actor(client), { roleId: data?.id, changes: data?.data });
    return res;
  }

  @RequirePermissions("gestion.staff")
  @SubscribeMessage("role:delete")
  async deleteRole(@ConnectedSocket() client: Socket, @MessageBody() data: { id: string }) {
    const res = await this.broadcast("roles:list", () => this.management.deleteRole(data?.id));
    if (res.ok) await this.journal.log("ROLE_DELETE", this.actor(client), { roleId: data?.id });
    return res;
  }

  // ── Pointage (tracé dans le JET) ──
  // Tout équipier connecté pointe ; staffId fourni pour un rejeu hors-ligne après changement d'opérateur (comme operatorId à l'encaissement)
  @RequirePermissions("salle.view", "cuisine.view", "caisse.checkout", "dashboard.view", "gestion.staff")
  @SubscribeMessage("shift:clock")
  async clock(@ConnectedSocket() client: Socket, @MessageBody() data: { id?: string; staffId?: string; action: string; at?: number }) {
    const res = await this.broadcast("shifts:open", async () => {
      const session = client.data.user;
      const staffId = data?.staffId || session.staffId;
      // 🔒 Pointer un collègue : gestionnaire, ou rejeu d'un pointage saisi avant l'ouverture de cette session
      const queuedBefore = Number(data?.at) < session.exp - SESSION_MS;
      if (staffId !== session.staffId && !queuedBefore && !hasAnyPermission(session, ["gestion.staff"])) {
        throw new Error("Chacun pointe pour soi : le pointage d'un collègue est réservé au gestionnaire");
      }
      const shift = await this.management.clock({ ...data, staffId });
      if (shift) await this.journal.log(data.action === "in" ? "SHIFT_IN" : "SHIFT_OUT", this.actor(client), { shiftId: shift.id, staffId: shift.staffId });
      return this.management.listOpenShifts();
    });
    return res;
  }

  @RequirePermissions("salle.view", "cuisine.view", "caisse.checkout", "dashboard.view", "gestion.staff")
  @SubscribeMessage("shift:open_list")
  async openShifts() {
    return { ok: true, shifts: await this.management.listOpenShifts() };
  }

  @RequirePermissions("gestion.staff")
  @SubscribeMessage("shift:list")
  async listShifts(@MessageBody() data: { from: number; to: number }) {
    try {
      const from = new Date(Number(data?.from));
      const to = new Date(Number(data?.to));
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return { ok: false, error: "Période invalide" };
      return { ok: true, shifts: await this.management.listShifts(from, to) };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @RequirePermissions("gestion.staff")
  @SubscribeMessage("shift:close")
  async closeShift(@ConnectedSocket() client: Socket, @MessageBody() data: { id: string; endAt: number }) {
    const res = await this.broadcast("shifts:open", async () => {
      await this.management.closeShift(data?.id, data?.endAt, client.data.user.name);
      return this.management.listOpenShifts();
    });
    if (res.ok) await this.journal.log("SHIFT_CLOSE", this.actor(client), { shiftId: data?.id, endAt: data?.endAt });
    return res;
  }

  // Rapport en lecture : montants des pourboires et heures de chacun
  @RequirePermissions("gestion.staff", "caisse.close")
  @SubscribeMessage("tips:distribution")
  async tipsDistribution(@MessageBody() data: { from: number; to: number; options?: any }) {
    try {
      const report = await this.management.tipsDistribution(new Date(Number(data?.from)), new Date(Number(data?.to)), data?.options ?? {});
      return { ok: true, report };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  private actor(client: Socket) {
    return { staffId: client.data.user.staffId, name: client.data.user.name };
  }
}
