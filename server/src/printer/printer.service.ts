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
    if (!ip || !ip.trim()) {
      return { success: false, error: "Adresse IP d'imprimante manquante" };
    }

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
    if (!ip || !ip.trim()) {
      return { success: false, error: "Adresse IP manquante" };
    }

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
