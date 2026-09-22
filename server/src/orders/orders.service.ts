import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async findActive() {
    return this.prisma.order.findMany({
      where: { status: "open" },
      include: { items: true, table: true },
    });
  }

  async findHistory(limit = 100) {
    return this.prisma.orderHistory.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }
}
