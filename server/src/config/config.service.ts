import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as crypto from "crypto";

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig() {
    let cfg = await this.prisma.restaurantConfig.findUnique({
      where: { id: "default" },
    });

    if (!cfg) {
      cfg = await this.prisma.restaurantConfig.create({
        data: {
          id: "default",
          nf525Key: crypto.randomBytes(32).toString("hex"),
          name: "RestoFlow Bistrot",
          legalName: "RESTOFLOW SAS",
          siret: "987 654 321 00012",
          vatNumber: "FR 12 987654321",
          address: "14 Rue de la Paix",
          city: "75002 Paris",
          phone: "01 42 68 55 00",
          email: "contact@restoflow-bistrot.fr",
          website: "www.restoflow.fr",
          footerNote: "Merci de votre visite ! Service et taxes compris.",
          currency: "EUR",
          tpeAutoPrint: true,
          printers: "[]",
          promoCodes: "[]",
        },
      });
    }

    // 🔒 La clé de scellement NF525 ne quitte jamais le serveur
    const { nf525Key: _secret, ...publicCfg } = cfg;
    return {
      ...publicCfg,
      printers: JSON.parse(cfg.printers || "[]"),
      promoCodes: JSON.parse(cfg.promoCodes || "[]"),
      happyHourConfig: cfg.happyHourConfig ? JSON.parse(cfg.happyHourConfig) : {
        enabled: false,
        startTime: "17:00",
        endTime: "20:00",
        days: [1, 2, 3, 4, 5],
        discountPercent: 20,
        categories: ["boissons"],
      },
      fecExportConfig: cfg.fecExportConfig ? JSON.parse(cfg.fecExportConfig) : {
        journalCode: "VT",
        accountVente10: "706000",
        accountVente20: "707000",
        accountVat10: "445710",
        accountVat20: "445720",
        accountCard: "512000",
        accountCash: "530000",
        accountOther: "580000",
      },
    };
  }

  /**
   * Clé secrète de scellement NF525 (usage serveur uniquement)
   */
  async getNf525Key(): Promise<string> {
    await this.getConfig(); // crée la config (et sa clé) si absente
    const cfg = await this.prisma.restaurantConfig.findUnique({
      where: { id: "default" },
      select: { nf525Key: true },
    });
    if (!cfg?.nf525Key) throw new Error("Clé NF525 absente de la configuration");
    return cfg.nf525Key;
  }

  async updateConfig(data: any) {
    const updatePayload: any = {};
    const stringFields = [
      "name",
      "legalName",
      "siret",
      "vatNumber",
      "address",
      "city",
      "phone",
      "email",
      "website",
      "footerNote",
      "currency",
    ];

    for (const f of stringFields) {
      if (data[f] !== undefined) updatePayload[f] = String(data[f]);
    }

    if (data.tpeAutoPrint !== undefined) {
      updatePayload.tpeAutoPrint = Boolean(data.tpeAutoPrint);
    }

    if (data.printers !== undefined) {
      updatePayload.printers =
        typeof data.printers === "string" ? data.printers : JSON.stringify(data.printers);
    }

    if (data.promoCodes !== undefined) {
      updatePayload.promoCodes =
        typeof data.promoCodes === "string" ? data.promoCodes : JSON.stringify(data.promoCodes);
    }

    if (data.happyHourConfig !== undefined) {
      updatePayload.happyHourConfig =
        typeof data.happyHourConfig === "string"
          ? data.happyHourConfig
          : JSON.stringify(data.happyHourConfig);
    }

    if (data.fecExportConfig !== undefined) {
      updatePayload.fecExportConfig =
        typeof data.fecExportConfig === "string"
          ? data.fecExportConfig
          : JSON.stringify(data.fecExportConfig);
    }

    const updated = await this.prisma.restaurantConfig.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        ...updatePayload,
      },
      update: updatePayload,
    });

    return {
      ...updated,
      printers: JSON.parse(updated.printers || "[]"),
      promoCodes: JSON.parse(updated.promoCodes || "[]"),
      happyHourConfig: updated.happyHourConfig ? JSON.parse(updated.happyHourConfig) : null,
      fecExportConfig: updated.fecExportConfig ? JSON.parse(updated.fecExportConfig) : null,
    };
  }
}
