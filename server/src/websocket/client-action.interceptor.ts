import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { from, of, mergeMap } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";

const ACTION_ID = /^[\w-]{8,80}$/;

/**
 * Idempotence des actions temps réel : chaque action porte un clientActionId généré par le terminal.
 * Une action déjà appliquée (rejeu de la file hors-ligne, ré-émission après un acquittement perdu)
 * est acquittée sans être rejouée.
 * ponytail: deux émissions simultanées du même id peuvent encore passer toutes les deux ; verrou par id si besoin
 */
@Injectable()
export class ClientActionInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const data = context.switchToWs().getData();
    const id = typeof data?.clientActionId === "string" && ACTION_ID.test(data.clientActionId) ? data.clientActionId : null;
    if (!id) return next.handle();

    if (await this.prisma.processedAction.findUnique({ where: { id } })) {
      return of({ ok: true, duplicate: true });
    }

    return next.handle().pipe(
      mergeMap((result: any) =>
        from(
          (async () => {
            // Seules les actions acceptées sont mémorisées : une action rejetée peut être corrigée puis renvoyée
            if (result?.ok !== false) {
              await this.prisma.processedAction
                .create({ data: { id, handler: context.getHandler().name } })
                .catch(() => {});
            }
            return result;
          })()
        )
      )
    );
  }
}
