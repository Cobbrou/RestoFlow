import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";

const ID_KEY = /^(ids?|\w+Ids?)$/;
const isScalar = (v: unknown) => v === null || typeof v !== "object";

/**
 * Lève si un identifiant (id, orderId, itemIds…) n'est pas une valeur simple, à toute profondeur.
 * Sinon { orderId: { not: "" } } passé tel quel à Prisma viserait toutes les commandes.
 */
export function assertScalarIds(value: unknown, path = "données"): void {
  if (isScalar(value)) return;
  for (const [key, v] of Object.entries(value as object)) {
    const at = `${path}.${key}`;
    if (ID_KEY.test(key) && !(isScalar(v) || (Array.isArray(v) && v.every(isScalar)))) {
      throw new WsException(`Identifiant invalide : ${at}`);
    }
    assertScalarIds(v, at);
  }
}

@Injectable()
export class ScalarIdsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    assertScalarIds(context.switchToWs().getData());
    return true;
  }
}
