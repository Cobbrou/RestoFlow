import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

export interface SessionPayload {
  staffId: string;
  name: string;
  roleId: string;
  permissions: string[];
  exp: number;
}

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production');
  }
  return 'restoflow-dev-only-key-DO-NOT-USE-IN-PROD';
})();

@Injectable()
export class AuthService {
  private pinAttempts = new Map<string, { count: number; lastAttempt: number }>();
  private readonly MAX_PIN_ATTEMPTS = 5;
  private readonly PIN_LOCKOUT_MS = 60_000; // 1 minute lockout

  constructor(private prisma: PrismaService) {}

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
      const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
      const payload: SessionPayload = JSON.parse(Buffer.from(body, "base64url").toString());
      if (payload.exp && Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async verifyPin(pin: string, staffId?: string) {
    const rateLimitKey = staffId || 'global';
    const attempt = this.pinAttempts.get(rateLimitKey);
    if (attempt && attempt.count >= this.MAX_PIN_ATTEMPTS && (Date.now() - attempt.lastAttempt) < this.PIN_LOCKOUT_MS) {
      throw new UnauthorizedException(`Trop de tentatives. Réessayez dans ${Math.ceil((this.PIN_LOCKOUT_MS - (Date.now() - attempt.lastAttempt)) / 1000)} secondes.`);
    }

    if (!pin || pin.length < 4) {
      throw new UnauthorizedException("Code PIN invalide (4 chiffres requis)");
    }

    let staff = null;
    if (staffId) {
      staff = await this.prisma.staff.findFirst({
        where: { id: staffId, active: true },
        include: { role: true },
      });
      if (!staff) {
        throw new UnauthorizedException("Équipier introuvable ou compte inactif");
      }
      const matches = bcrypt.compareSync(pin, staff.pin);
      if (!matches) {
        const current = this.pinAttempts.get(rateLimitKey) || { count: 0, lastAttempt: 0 };
        this.pinAttempts.set(rateLimitKey, { count: current.count + 1, lastAttempt: Date.now() });
        throw new UnauthorizedException("Code PIN incorrect");
      }
    } else {
      // Recherche globale sur tous les équipiers actifs
      const activeStaffList = await this.prisma.staff.findMany({
        where: { active: true },
        include: { role: true },
      });

      for (const candidate of activeStaffList) {
        if (bcrypt.compareSync(pin, candidate.pin)) {
          staff = candidate;
          break;
        }
      }

      if (!staff) {
        const current = this.pinAttempts.get(rateLimitKey) || { count: 0, lastAttempt: 0 };
        this.pinAttempts.set(rateLimitKey, { count: current.count + 1, lastAttempt: Date.now() });
        throw new UnauthorizedException("Code PIN non reconnu");
      }
    }

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

    this.pinAttempts.delete(rateLimitKey);

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
