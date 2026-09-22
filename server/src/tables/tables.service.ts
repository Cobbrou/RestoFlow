import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.table.findMany({ orderBy: { number: "asc" } });
  }

  async findOne(id: string) {
    return this.prisma.table.findUnique({ where: { id } });
  }

  async create(data: any) {
    return this.prisma.table.create({ data });
  }

  async update(id: string, data: any) {
    return this.prisma.table.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.table.delete({ where: { id } });
  }
}
