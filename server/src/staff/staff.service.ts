import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async getStaff() {
    return this.prisma.staff.findMany({
      include: { role: true },
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
