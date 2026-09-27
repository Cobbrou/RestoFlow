import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { AuthService, SessionPayload } from "../auth.service";

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const data = context.switchToWs().getData();

    // 1. Déjà authentifié dans cette connexion Socket
    if (client.data?.user) {
      return true;
    }

    // 2. Extraction du token
    const token =
      client.handshake?.auth?.token ||
      (client.handshake?.headers?.authorization?.startsWith("Bearer ")
        ? client.handshake.headers.authorization.slice(7)
        : null) ||
      (typeof data === "object" && data !== null ? data._token || data.token : null);

    if (!token) {
      this.logger.warn(`Tentative d'accès non authentifié sur socket ${client.id}`);
      throw new WsException("Authentification requise : token manquant");
    }

    const payload: SessionPayload | null = this.authService.verifyToken(token);
    if (!payload) {
      this.logger.warn(`Token invalide ou expiré sur socket ${client.id}`);
      throw new WsException("Session invalide ou expirée, veuillez vous reconnecter");
    }

    // Attachement du payload au socket
    client.data.user = payload;
    return true;
  }
}
