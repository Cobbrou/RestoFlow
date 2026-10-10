import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { AuthService, SessionPayload } from "../auth.service";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

@Injectable()
export class WsPermissionsGuard implements CanActivate {
  private readonly logger = new Logger(WsPermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    private authService: AuthService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    // Si aucune permission n'est spécifiée, l'accès est libre
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // WsAuthGuard (exécuté avant) a déjà authentifié le socket
    const client: Socket = context.switchToWs().getClient();
    const user: SessionPayload | null = client.data?.user || null;

    if (!user) {
      throw new WsException("Authentification requise pour effectuer cette opération");
    }

    // Le profil admin a tous les droits par défaut
    if (user.roleId === "admin") {
      return true;
    }

    const userPerms = Array.isArray(user.permissions) ? user.permissions : [];
    const hasPermission = requiredPermissions.some((perm) => userPerms.includes(perm));

    if (!hasPermission) {
      this.logger.warn(
        `Accès refusé pour l'utilisateur ${user.name} (${user.roleId}). Permissions requises: [${requiredPermissions.join(", ")}]`
      );
      throw new WsException(
        `Droits insuffisants. Cette action requiert les permissions : ${requiredPermissions.join(", ")}`
      );
    }

    return true;
  }
}
