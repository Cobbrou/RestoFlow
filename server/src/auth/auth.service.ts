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
// (les sessions sont alors invalidées à chaque redémarrage du serveur)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  new Logger("AuthService").warn(
    "JWT_SECRET non défini : clé de session éphémère générée, les sessions expirent au redémarrage."
  );
}

// Anti brute-force du PIN : verrouillage après N échecs consécutifs par équipier
// ponytail: compteur en mémoire mono-processus, à déplacer en base si plusieurs instances serveur
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MS = 5 * 60 * 1000;
const pinFailures = new Map<string, { count: number; lockedUntil: number }>();

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private journal: JournalService
  ) {}

  generateToken(staff: { id: string; name: string; roleId: string; permissions: string[] }): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const exp = Date.now() + 12 * 3600 * 1000; // 12 heures
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

  verifyToken(token: string): SessionPayload | null {
    try {
      if (!token) return null;
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const [header, body, signature] = parts;
      const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest();
      const given = Buffer.from(signature, "base64url");
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
      const payload: SessionPayload = JSON.parse(Buffer.from(body, "base64url").toString());
      if (!payload.exp || Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
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

  async verifyPin(pin: string, staffId?: string) {
    if (!pin || pin.length < 4) {
      throw new UnauthorizedException("Code PIN invalide (4 chiffres requis)");
    }
    if (!staffId) {
      throw new UnauthorizedException("Sélectionnez un équipier avant de saisir le PIN");
    }

    const failure = pinFailures.get(staffId);
    if (failure && failure.lockedUntil > Date.now()) {
      const minutes = Math.ceil((failure.lockedUntil - Date.now()) / 60000);
      await this.journal.log("AUTH_LOCKED", { staffId }, { minutes });
      throw new UnauthorizedException(`Trop de tentatives. Réessayez dans ${minutes} min`);
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, active: true },
      include: { role: true },
    });
    if (!staff) {
      throw new UnauthorizedException("Équipier introuvable ou compte inactif");
    }

    if (!(await bcrypt.compare(pin, staff.pin))) {
      const count = (failure?.count || 0) + 1;
      pinFailures.set(staffId, {
        count: count >= MAX_PIN_ATTEMPTS ? 0 : count,
        lockedUntil: count >= MAX_PIN_ATTEMPTS ? Date.now() + PIN_LOCK_MS : 0,
      });
      await this.journal.log("AUTH_FAIL", { staffId, name: staff.name }, { attempt: count });
      throw new UnauthorizedException("Code PIN incorrect");
    }
    pinFailures.delete(staffId);
    await this.journal.log("AUTH_OK", { staffId, name: staff.name }, { roleId: staff.roleId });

    const permissions: string[] = JSON.parse(staff.role.permissions || "[]");
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
