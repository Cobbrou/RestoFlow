import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from "@nestjs/websockets";
import { UseGuards, UseInterceptors } from "@nestjs/common";
import { Server } from "socket.io";
import { WsAuthGuard, STAFF_ROOM, SENSITIVE, emitWithContacts } from "../auth/guards/ws-auth.guard";
import { ScalarIdsGuard } from "../auth/guards/scalar-ids.guard";
import { WsPermissionsGuard } from "../auth/guards/ws-permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { ClientActionInterceptor } from "../websocket/client-action.interceptor";
import { ALLOWED_ORIGINS } from "../cors";
import { ReservationsService } from "./reservations.service";

@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS } })
@UseGuards(ScalarIdsGuard, WsAuthGuard, WsPermissionsGuard)
@UseInterceptors(ClientActionInterceptor)
@RequirePermissions("salle.reservations")
export class ReservationsGateway {
  @WebSocketServer()
  server: Server;

  constructor(private reservations: ReservationsService) {}

  private async run(fn: () => Promise<any>) {
    try {
      return await fn();
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  @SubscribeMessage("reservation:create")
  create(@MessageBody() data: any) {
    return this.run(async () => {
      const reservation = await this.reservations.create(data);
      emitWithContacts(this.server, "reservation:created", reservation, SENSITIVE.reservationContacts);
      return { ok: true, reservation };
    });
  }

  @SubscribeMessage("reservation:update_status")
  updateStatus(@MessageBody() data: { id: string; status: string }) {
    return this.run(async () => {
      const reservation = await this.reservations.updateStatus(data?.id, data?.status);
      emitWithContacts(this.server, "reservation:updated", reservation, SENSITIVE.reservationContacts);
      return { ok: true, reservation };
    });
  }

  @SubscribeMessage("reservation:assign_table")
  assignTable(@MessageBody() data: { id: string; tableId: string | null }) {
    return this.run(async () => {
      const reservation = await this.reservations.assignTable(data?.id, data?.tableId);
      emitWithContacts(this.server, "reservation:updated", reservation, SENSITIVE.reservationContacts);
      return { ok: true, reservation };
    });
  }

  @SubscribeMessage("reservation:delete")
  remove(@MessageBody() data: { id: string }) {
    return this.run(async () => {
      await this.reservations.remove(data?.id);
      this.server.to(STAFF_ROOM).emit("reservation:deleted", { id: data.id });
      return { ok: true, id: data.id };
    });
  }
}
