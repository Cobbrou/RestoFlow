import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

// Colonnes d'un ticket figées dès sa création (seul closedInZId peut être renseigné, une fois, par le Z)
const FROZEN_TICKET_COLUMNS =
  "id, orderId, ticketNumber, tableNumber, server, items, total, subtotal, discount, vatDetails, paymentMethod, " +
  "payments, sequenceNumber, previousHash, signature, type, refTicketNumber, reason, createdAt";

/**
 * Inaltérabilité NF525 au niveau base : tickets, rapports Z et journal JET sont en ajout seul.
 * (Garde-fou contre les modifications applicatives ; les signatures détectent toute altération directe du fichier.)
 */
export const NF525_TRIGGERS: Record<string, string> = {
  nf525_ticket_no_delete: `CREATE TRIGGER IF NOT EXISTS nf525_ticket_no_delete BEFORE DELETE ON OrderHistory
    BEGIN SELECT RAISE(ABORT, 'NF525 : ticket inaltérable'); END`,
  nf525_ticket_frozen: `CREATE TRIGGER IF NOT EXISTS nf525_ticket_frozen BEFORE UPDATE OF ${FROZEN_TICKET_COLUMNS} ON OrderHistory
    BEGIN SELECT RAISE(ABORT, 'NF525 : ticket inaltérable'); END`,
  nf525_ticket_z_once: `CREATE TRIGGER IF NOT EXISTS nf525_ticket_z_once BEFORE UPDATE OF closedInZId ON OrderHistory
    WHEN OLD.closedInZId IS NOT NULL BEGIN SELECT RAISE(ABORT, 'NF525 : ticket déjà clôturé'); END`,
  nf525_z_no_update: `CREATE TRIGGER IF NOT EXISTS nf525_z_no_update BEFORE UPDATE ON DailyClosing
    BEGIN SELECT RAISE(ABORT, 'NF525 : rapport Z inaltérable'); END`,
  nf525_z_no_delete: `CREATE TRIGGER IF NOT EXISTS nf525_z_no_delete BEFORE DELETE ON DailyClosing
    BEGIN SELECT RAISE(ABORT, 'NF525 : rapport Z inaltérable'); END`,
  nf525_jet_no_update: `CREATE TRIGGER IF NOT EXISTS nf525_jet_no_update BEFORE UPDATE ON EventLog
    BEGIN SELECT RAISE(ABORT, 'NF525 : journal inaltérable'); END`,
  nf525_jet_no_delete: `CREATE TRIGGER IF NOT EXISTS nf525_jet_no_delete BEFORE DELETE ON EventLog
    BEGIN SELECT RAISE(ABORT, 'NF525 : journal inaltérable'); END`,
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // Fichier SQLite absent ou vide (créé à la volée) : on guide plutôt que d'échouer sur les triggers
    const tables = await this.$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'OrderHistory'"
    );
    if (tables.length === 0) {
      throw new Error("Base de données vide ou non initialisée : lancez `npm run db:push` puis `npm run db:seed` dans server/");
    }
    for (const sql of Object.values(NF525_TRIGGERS)) {
      await this.$executeRawUnsafe(sql);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
