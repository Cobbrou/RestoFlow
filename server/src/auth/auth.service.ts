import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async verifyPin(pin: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { pin, active: true },
      include: { role: true },
    });

    if (!staff) {
      throw new UnauthorizedException("Code PIN invalide ou compte inactif");
    }

    return {
      id: staff.id,
      name: staff.name,
      roleId: staff.roleId,
      avatarBg: staff.avatarBg,
      role: {
        ...staff.role,
        permissions: JSON.parse(staff.role.permissions || "[]"),
      },
    };
  }
}
