import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from "@nestjs/websockets";
import { UseGuards, UseInterceptors } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { WsAuthGuard } from "../auth/guards/ws-auth.guard";
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
@UseGuards(WsAuthGuard, WsPermissionsGuard)
@UseInterceptors(ClientActionInterceptor)
export class ManagementGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private management: ManagementService,
    private journal: JournalService
  ) {}

  private async broadcast(event: string, mutation: () => Promise<any>) {
    try {
      const list = await mutation();
      this.server.emit(event, list);
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
    const res = await this.broadcast("staff:list", () => this.management.createStaff(data));
    if (res.ok) await this.journal.log("STAFF_CREATE", this.actor(client), { name: data?.name, roleId: data?.roleId });
    return res;
  }

  @RequirePermissions("gestion.staff")
  @SubscribeMessage("staff:update")
  async updateStaff(@ConnectedSocket() client: Socket, @MessageBody() data: { id: string; data: any }) {
    const res = await this.broadcast("staff:list", () =>
      this.management.updateStaff(data?.id, data?.data, client.data.user.staffId)
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
    const res = await this.broadcast("staff:list", () => this.management.deleteStaff(data?.id, client.data.user.staffId));
    if (res.ok) await this.journal.log("STAFF_DELETE", this.actor(client), { staffId: data?.id });
    return res;
  }

  // ── Rôles (tracé dans le JET) ──
  @RequirePermissions("gestion.staff")
  @SubscribeMessage("role:create")
  async createRole(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const res = await this.broadcast("roles:list", () => this.management.createRole(data));
    if (res.ok) await this.journal.log("ROLE_CREATE", this.actor(client), { name: data?.name, permissions: data?.permissions });
    return res;
  }

  @RequirePermissions("gestion.staff")
  @SubscribeMessage("role:update")
  async updateRole(@ConnectedSocket() client: Socket, @MessageBody() data: { id: string; data: any }) {
    const res = await this.broadcast("roles:list", () => this.management.updateRole(data?.id, data?.data));
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

  private actor(client: Socket) {
    return { staffId: client.data.user.staffId, name: client.data.user.name };
  }
}
