import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { AuthService, SessionPayload } from "../auth.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Extrait et vérifie le jeton de session d'un socket (handshake ou header Authorization)
 */
export function authenticateSocket(client: Socket, authService: AuthService): SessionPayload | null {
  const header = client.handshake?.headers?.authorization;
  const token =
    client.handshake?.auth?.token || (header?.startsWith("Bearer ") ? header.slice(7) : null);
  const user = token ? authService.verifyToken(token) : null;
  client.data.user = user;
  return user;
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private authService: AuthService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const client: Socket = context.switchToWs().getClient();
    let user: SessionPayload | null = client.data?.user || null;

    // Session expirée en cours de connexion : on revérifie le jeton
    if (!user || Date.now() > user.exp) {
      user = authenticateSocket(client, this.authService);
    }

    if (!user) {
      this.logger.warn(`Tentative d'accès non authentifié sur socket ${client.id}`);
      client.emit("auth:required");
      throw new WsException("Session invalide ou expirée, veuillez vous reconnecter");
    }

    return true;
  }
}
