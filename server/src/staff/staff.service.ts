import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async getStaff() {
    return this.prisma.staff.findMany({
      // 🔒 Jamais de hash de PIN dans une réponse API
      select: {
        id: true,
        name: true,
        roleId: true,
        email: true,
        phone: true,
        active: true,
        avatarBg: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async getRoles() {
    const roles = await this.prisma.role.findMany();
    return roles.map((r) => ({
      ...r,
      permissions: JSON.parse(r.permissions || "[]"),
    }));
  }
}
