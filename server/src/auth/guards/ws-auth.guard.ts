import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { AuthService, SessionPayload } from "../auth.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

export const STAFF_ROOM = "staff";

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
