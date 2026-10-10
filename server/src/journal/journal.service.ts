import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";

const GENESIS_EVENT = "GENESIS_JET_RESTOFLOW";

export interface JournalActor {
  staffId?: string | null;
  name?: string | null;
}

/**
 * Journal des Événements Techniques (JET) exigé par la NF525 :
 * connexions, clôtures, avoirs, remises, paramétrage, exports, audits.
 * Chaque événement est numéroté, chaîné au précédent et signé (HMAC, clé NF525).
 */
@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(private prisma: PrismaService) {}

  private sign(e: { sequenceNumber: number; type: string; staffId: string | null; details: string; createdAt: Date; previousHash: string }, key: string) {
    const payload = [e.sequenceNumber, e.type, e.staffId || "", e.createdAt.toISOString(), e.details, e.previousHash].join("|");
    return crypto.createHmac("sha256", key).update(payload).digest("hex");
  }

  private async key() {
    const cfg = await this.prisma.restaurantConfig.findUnique({ where: { id: "default" }, select: { nf525Key: true } });
    if (!cfg?.nf525Key) throw new Error("Clé NF525 absente de la configuration");
    return cfg.nf525Key;
  }

  /**
   * Ajoute un événement. Ne lève jamais : un échec de journalisation est tracé dans les logs serveur
   * sans bloquer l'opération métier (déjà validée).
   */
  async log(type: string, actor: JournalActor | null, details: Record<string, any> = {}) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const key = await this.key();
        await this.prisma.$transaction(async (tx) => {
          const last = await tx.eventLog.findFirst({ orderBy: { sequenceNumber: "desc" } });
          const event = {
            sequenceNumber: (last?.sequenceNumber || 0) + 1,
            type,
            staffId: actor?.staffId || null,
            details: JSON.stringify(details),
            createdAt: new Date(),
            previousHash: last?.signature || GENESIS_EVENT,
          };
          await tx.eventLog.create({
            data: {
              id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              ...event,
              staffName: actor?.name || null,
              signature: this.sign(event, key),
            },
          });
        });
        return;
      } catch (err: any) {
        if (err?.code === "P2002" && attempt < 3) continue;
        this.logger.error(`JET : échec d'enregistrement de l'événement ${type} : ${err?.message}`);
        return;
      }
    }
  }

  async list(limit = 200) {
    const events = await this.prisma.eventLog.findMany({ orderBy: { sequenceNumber: "desc" }, take: limit });
    return events.map((e) => ({ ...e, details: JSON.parse(e.details), createdAt: e.createdAt.getTime() }));
  }

  /** Vérifie séquence, chaînage et signatures de tout le journal */
  async verify() {
    const key = await this.key();
    const events = await this.prisma.eventLog.findMany({ orderBy: { sequenceNumber: "asc" } });
    const errors: string[] = [];
    let previous = GENESIS_EVENT;
    events.forEach((e, i) => {
      if (e.sequenceNumber !== i + 1) errors.push(`JET : trou de séquence avant l'événement n°${e.sequenceNumber}`);
      if (e.previousHash !== previous) errors.push(`JET : rupture de chaînage à l'événement n°${e.sequenceNumber}`);
      if (this.sign(e, key) !== e.signature) errors.push(`JET : événement n°${e.sequenceNumber} altéré`);
      previous = e.signature;
    });
    return { eventsVerified: events.length, errors };
  }
}
