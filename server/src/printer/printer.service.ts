import { Injectable, Logger } from "@nestjs/common";
import * as net from "net";

export interface PrinterTestResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
}

export interface PrinterSendResult {
  success: boolean;
  bytesWritten?: number;
  error?: string;
}

/** Initialisation ESC/POS + table de caractères WPC1252 (ESC t 16), à envoyer en tête de chaque ticket */
export const ESCPOS_INIT = "\x1b\x40\x1b\x74\x10";

// Caractères de Windows-1252 hors latin1 (0x80-0x9F) ; copie dans src/utils/escpos.js
const CP1252_EXTRA: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94,
  "•": 0x95, "–": 0x96, "—": 0x97, "Œ": 0x8c, "œ": 0x9c, "Ÿ": 0x9f,
};

/** Texte vers octets Windows-1252 (é, à, œ, €…) ; caractère non imprimable (emoji…) remplacé par "?" */
export function encodeCp1252(text: string): Buffer {
  return Buffer.from(
    Array.from(text, (ch) => {
      const code = ch.codePointAt(0)!;
      if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) return code;
      return CP1252_EXTRA[ch] ?? 0x3f;
    })
  );
}

// 🔒 Jamais la machine elle-même (API d'admin Caddy, base…) ni une adresse locale au lien
const NOT_A_PRINTER = new net.BlockList();
NOT_A_PRINTER.addSubnet("0.0.0.0", 8);
NOT_A_PRINTER.addSubnet("127.0.0.0", 8);
NOT_A_PRINTER.addSubnet("169.254.0.0", 16);
NOT_A_PRINTER.addAddress("::", "ipv6");
NOT_A_PRINTER.addAddress("::1", "ipv6");
NOT_A_PRINTER.addSubnet("fe80::", 10, "ipv6");

/** Motif de refus d'une adresse d'imprimante réseau (IP littérale du LAN et port TCP valide), null si acceptable */
export function printerAddressError(ip: unknown, port: unknown = 9100): string | null {
  const family = typeof ip === "string" ? net.isIP(ip) : 0;
  if (!family) return `Adresse IP d'imprimante invalide : ${String(ip)}`;
  if (NOT_A_PRINTER.check(ip as string, family === 4 ? "ipv4" : "ipv6")) return `Adresse IP non autorisée pour une imprimante : ${ip}`;
  const p = Number(port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) return `Port d'imprimante invalide : ${String(port)}`;
  return null;
}

@Injectable()
export class PrinterService {
  private readonly logger = new Logger(PrinterService.name);

  /**
   * Envoie des trames d'octets brutes (ESC/POS) directement sur une imprimante réseau via TCP port 9100
   */
  async sendRaw(
    ip: string,
    port = 9100,
    buffer: Buffer | Uint8Array,
    timeoutMs = 3500
  ): Promise<PrinterSendResult> {
    const refused = printerAddressError(ip, port);
    if (refused) return { success: false, error: refused };

    const payload = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const finish = (result: PrinterSendResult) => {
        if (!resolved) {
          resolved = true;
          // Succès : end() vide le tampon puis ferme proprement (destroy() pouvait tronquer la fin du ticket)
          if (result.success) socket.end();
          else socket.destroy();
          resolve(result);
        }
      };

      socket.setTimeout(timeoutMs);

      socket.connect(port, ip, () => {
        this.logger.log(`Connecté à l'imprimante réseau ${ip}:${port}, envoi de ${payload.length} octets...`);
        socket.write(payload, (err) => {
          if (err) {
            this.logger.error(`Erreur d'écriture sur ${ip}:${port}`, err);
            finish({ success: false, error: err.message });
          } else {
            this.logger.log(`Trame imprimée avec succès sur ${ip}:${port}`);
            finish({ success: true, bytesWritten: payload.length });
          }
        });
      });

      // Après end(), l'imprimante peut tarder à fermer : on ne laisse pas traîner la connexion
      socket.on("finish", () => setTimeout(() => socket.destroy(), timeoutMs).unref());

      socket.on("timeout", () => {
        this.logger.warn(`Délai d'attente dépassé (timeout) pour l'imprimante ${ip}:${port}`);
        finish({ success: false, error: `Délai dépassé (${timeoutMs}ms) : imprimante injoignable` });
      });

      socket.on("error", (err) => {
        this.logger.error(`Erreur de connexion socket imprimante ${ip}:${port}: ${err.message}`);
        finish({ success: false, error: err.message });
      });
    });
  }

  /**
   * Teste la joignabilité d'une imprimante réseau sur son port raw 9100
   */
  async testPrinter(ip: string, port = 9100, timeoutMs = 2500): Promise<PrinterTestResult> {
    const refused = printerAddressError(ip, port);
    if (refused) return { success: false, error: refused };

    const startTime = Date.now();

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const finish = (result: PrinterTestResult) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(result);
        }
      };

      socket.setTimeout(timeoutMs);

      socket.connect(port, ip, () => {
        const latencyMs = Date.now() - startTime;
        this.logger.log(`Test imprimante ${ip}:${port} réussi en ${latencyMs}ms`);
        finish({ success: true, latencyMs });
      });

      socket.on("timeout", () => {
        finish({ success: false, error: `Timeout (${timeoutMs}ms) : l'imprimante ne répond pas` });
      });

      socket.on("error", (err) => {
        finish({ success: false, error: `Échec de connexion : ${err.message}` });
      });
    });
  }
}
