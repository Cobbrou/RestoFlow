import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WsException } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { AuthService, SessionPayload } from "../auth.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

export const STAFF_ROOM = "staff";

// Données réservées : seuls les postes ayant au moins une de ces permissions les reçoivent
export const SENSITIVE = {
  history: ["caisse.checkout", "caisse.history", "caisse.close", "caisse.fec", "dashboard.view"],
  closings: ["caisse.close", "caisse.history", "caisse.fec"],
  stockMovements: ["gestion.stocks", "gestion.recipes"],
  staffContacts: ["gestion.staff"],
  reservationContacts: ["salle.reservations"],
};

const ADMIN_ROOM = "perm:*";
/** Rooms des postes ayant au moins une des permissions (l'admin les a toutes) : server.to(permRooms(...)) */
export const permRooms = (perms: string[]) => [ADMIN_ROOM, ...perms.map((p) => `perm:${p}`)];

export const withoutContacts = <T extends object>({ email: _e, phone: _p, ...rest }: T & { email?: unknown; phone?: unknown }) => rest;

/** Coordonnées (e-mail, téléphone) diffusées aux seuls postes ayant une des permissions, retirées pour les autres */
export function emitWithContacts(server: Server, event: string, data: object | object[], perms: string[]) {
  const allowed = permRooms(perms);
  server.to(allowed).emit(event, data);
  server.to(STAFF_ROOM).except(allowed).emit(event, Array.isArray(data) ? data.map(withoutContacts) : withoutContacts(data));
}

export const hasAnyPermission = (user: SessionPayload | null, perms: string[]) =>
  !!user && (user.roleId === "admin" || perms.some((p) => (user.permissions || []).includes(p)));

/**
 * Extrait et vérifie le jeton de session d'un socket (handshake ou header Authorization),
 * puis relit en base le statut actif et les droits de l'équipier
 */
export async function authenticateSocket(client: Socket, authService: AuthService): Promise<SessionPayload | null> {
  const header = client.handshake?.headers?.authorization;
  const token =
    client.handshake?.auth?.token || (header?.startsWith("Bearer ") ? header.slice(7) : null);
  const user = await authService.refreshSession(token ? authService.verifyToken(token) : null);
  client.data.user = user;
  // 🔒 Seuls les sockets authentifiés reçoivent les diffusions (room STAFF_ROOM)
  if (user) client.join(STAFF_ROOM);
  else client.leave(STAFF_ROOM);
  // Rooms de permissions recalculées à chaque authentification (changement de rôle pris en compte)
  for (const room of client.rooms) if (room.startsWith("perm:")) client.leave(room);
  if (user) client.join(user.roleId === "admin" ? [ADMIN_ROOM] : (user.permissions || []).map((p) => `perm:${p}`));
  return user;
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const client: Socket = context.switchToWs().getClient();
    // À chaque action : jeton revérifié (expiration) et droits relus en base (désactivation, changement de rôle)
    const user = await authenticateSocket(client, this.authService);

    if (!user) {
      this.logger.warn(`Tentative d'accès non authentifié sur socket ${client.id}`);
      client.emit("auth:required");
      throw new WsException("Session invalide ou expirée, veuillez vous reconnecter");
    }

    return true;
  }
}
