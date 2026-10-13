import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JournalService } from "../journal/journal.service";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

export interface SessionPayload {
  staffId: string;
  name: string;
  roleId: string;
  permissions: string[];
  exp: number;
}

// 🔒 Jamais de secret par défaut versionné : sans JWT_SECRET, clé aléatoire par démarrage
// (les sessions sont alors invalidées à chaque redémarrage du serveur), refusé en production
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET obligatoire en production (voir deploy/DEPLOIEMENT.md).");
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  new Logger("AuthService").warn(
    "JWT_SECRET non défini : clé de session éphémère générée, les sessions expirent au redémarrage."
  );
}

/** Durée d'une session : son début vaut exp - SESSION_MS */
export const SESSION_MS = 12 * 3600 * 1000;

// Anti brute-force du PIN : verrouillage après N échecs consécutifs par équipier
// ponytail: compteur en mémoire mono-processus, à déplacer en base si plusieurs instances serveur
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MS = 5 * 60 * 1000;
const pinFailures = new Map<string, { count: number; lockedUntil: number }>();

export const PIN = /^\d{4,6}$/;

/** Rejeu hors-ligne : une action mise en file garde le jeton de son auteur, accepté jusqu'à 24 h après expiration */
export const REPLAY_GRACE_MS = 24 * 3600 * 1000;

// Copie côté client : src/utils/permissions.js (pinLengthFor)
const SENSITIVE_PIN_PERMISSIONS = ["gestion.staff", "caisse.settings", "caisse.close", "caisse.fec"];
/** PIN à 6 chiffres pour un profil sensible, 4 sinon */
export const pinLengthFor = (roleId: string, permissions: string[] = []) =>
  roleId === "admin" || permissions.some((p) => SENSITIVE_PIN_PERMISSIONS.includes(p)) ? 6 : 4;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private journal: JournalService
  ) {}

  generateToken(staff: { id: string; name: string; roleId: string; permissions: string[] }): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const exp = Date.now() + SESSION_MS;
    const payload: SessionPayload = {
      staffId: staff.id,
      name: staff.name,
      roleId: staff.roleId,
      permissions: staff.permissions,
      exp,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    return `${header}.${body}.${signature}`;
  }

  verifyToken(token: string, graceMs = 0): SessionPayload | null {
    try {
      if (!token) return null;
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const [header, body, signature] = parts;
      const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest();
      const given = Buffer.from(signature, "base64url");
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
      const payload: SessionPayload = JSON.parse(Buffer.from(body, "base64url").toString());
      if (!payload.exp || Date.now() > payload.exp + graceMs) return null;
      return payload;
    } catch {
      return null;
    }
  }

  isOperatorToken(token: unknown, staffId: unknown): boolean {
    return typeof token === "string" && typeof staffId === "string" && this.verifyToken(token, REPLAY_GRACE_MS)?.staffId === staffId;
  }

  /**
   * Session à jour : le jeton prouve l'identité, mais le statut actif et les droits sont relus en base
   * (un équipier désactivé ou changé de rôle est pris en compte immédiatement, sans attendre l'expiration)
   */
  async refreshSession(user: SessionPayload | null): Promise<SessionPayload | null> {
    if (!user) return null;
    const staff = await this.prisma.staff.findFirst({
      where: { id: user.staffId, active: true },
      include: { role: true },
    });
    if (!staff) return null;
    return { ...user, name: staff.name, roleId: staff.roleId, permissions: JSON.parse(staff.role?.permissions || "[]") };
  }

  async verifyPin(pin: unknown, staffId?: unknown) {
    // 🔒 Un objet ({ not: "" }) deviendrait un filtre Prisma au lieu d'un identifiant
    if (typeof pin !== "string" || !PIN.test(pin)) {
      throw new UnauthorizedException("Code PIN invalide (4 à 6 chiffres)");
    }
    if (typeof staffId !== "string" || !staffId) {
      throw new UnauthorizedException("Sélectionnez un équipier avant de saisir le PIN");
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, active: true },
      include: { role: true },
    });
    if (!staff) {
      throw new UnauthorizedException("Équipier introuvable ou compte inactif");
    }

    const permissions: string[] = JSON.parse(staff.role?.permissions || "[]");
    const pinLength = pinLengthFor(staff.roleId, permissions);
    if (pin.length !== pinLength) {
      throw new UnauthorizedException(`Ce profil exige un PIN à ${pinLength} chiffres : faites-le redéfinir par un gestionnaire`);
    }

    // 🔒 Tentative comptée avant la comparaison, sans await entre lecture et écriture du compteur :
    // des requêtes simultanées ne lisent pas toutes un compteur périmé
    const now = Date.now();
    const failure = pinFailures.get(staffId) ?? { count: 0, lockedUntil: 0 };
    if (failure.lockedUntil > now) {
      const minutes = Math.ceil((failure.lockedUntil - now) / 60000);
      await this.journal.log("AUTH_LOCKED", { staffId }, { minutes });
      throw new UnauthorizedException(`Trop de tentatives. Réessayez dans ${minutes} min`);
    }
    const attempt = failure.count + 1;
    pinFailures.set(staffId, {
      count: attempt >= MAX_PIN_ATTEMPTS ? 0 : attempt,
      lockedUntil: attempt >= MAX_PIN_ATTEMPTS ? now + PIN_LOCK_MS : 0,
    });

    if (!(await bcrypt.compare(pin, staff.pin))) {
      await this.journal.log("AUTH_FAIL", { staffId, name: staff.name }, { attempt });
      throw new UnauthorizedException("Code PIN incorrect");
    }
    pinFailures.delete(staffId);
    await this.journal.log("AUTH_OK", { staffId, name: staff.name }, { roleId: staff.roleId });

    const safeStaff = {
      id: staff.id,
      name: staff.name,
      roleId: staff.roleId,
      avatarBg: staff.avatarBg,
      permissions,
      role: {
        ...staff.role,
        permissions,
      },
    };

    const token = this.generateToken({
      id: safeStaff.id,
      name: safeStaff.name,
      roleId: safeStaff.roleId,
      permissions,
    });

    return {
      ok: true,
      staff: safeStaff,
      token,
    };
  }
}
