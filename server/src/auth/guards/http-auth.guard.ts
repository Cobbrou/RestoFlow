import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "../auth.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Guard HTTP global : toute route REST exige un jeton de session valide, sauf @Public()
 */
@Injectable()
export class HttpAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Les gateways WebSocket ont leurs propres guards
    if (context.getType() !== "http") return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const user = token ? this.authService.verifyToken(token) : null;
    if (!user) throw new UnauthorizedException("Session requise");

    req.user = user;
    return true;
  }
}
