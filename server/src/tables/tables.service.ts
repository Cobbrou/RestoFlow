import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
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

  async toggleAlert(tableId: string) {
    const table = await this.prisma.table.findUnique({ where: { id: tableId } });
    if (!table) throw new NotFoundException("Table introuvable");

    return this.prisma.table.update({
      where: { id: tableId },
      data: { alert: !table.alert },
    });
  }

  async transferTable(sourceTableId: string, targetTableId: string) {
    const sourceTable = await this.prisma.table.findUnique({ where: { id: sourceTableId } });
    const targetTable = await this.prisma.table.findUnique({ where: { id: targetTableId } });

    if (!sourceTable || !targetTable) {
      throw new NotFoundException("Table source ou cible introuvable");
    }

    const order = await this.prisma.order.findFirst({
      where: { tableId: sourceTableId, status: "open" },
      include: { items: true },
    });
    if (!order) {
      throw new BadRequestException("Aucune commande ouverte sur la table source");
    }

    const existingTargetOrder = await this.prisma.order.findFirst({
      where: { tableId: targetTableId, status: "open" },
    });
    if (existingTargetOrder) {
      throw new BadRequestException(`La table ${targetTable.number} est déjà occupée. Utilisez la fusion.`);
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { tableId: targetTableId },
    });

    const updatedSource = await this.prisma.table.update({
      where: { id: sourceTableId },
      data: { alert: false },
    });
    const updatedTarget = await this.prisma.table.findUnique({ where: { id: targetTableId } });

    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, table: true },
    });

    return {
      order: updatedOrder,
      sourceTable: updatedSource,
      targetTable: updatedTarget,
      sourceNumber: sourceTable.number,
      targetNumber: targetTable.number,
      server: order.server,
    };
  }

  async mergeTables(sourceTableId: string, targetTableId: string) {
    const sourceTable = await this.prisma.table.findUnique({ where: { id: sourceTableId } });
    const targetTable = await this.prisma.table.findUnique({ where: { id: targetTableId } });

    if (!sourceTable || !targetTable) {
      throw new NotFoundException("Table source ou cible introuvable");
    }

    const sourceOrder = await this.prisma.order.findFirst({
      where: { tableId: sourceTableId, status: "open" },
      include: { items: true },
    });
    const targetOrder = await this.prisma.order.findFirst({
      where: { tableId: targetTableId, status: "open" },
      include: { items: true },
    });

    if (!sourceOrder || !targetOrder) {
      throw new BadRequestException("Les deux tables doivent avoir une commande ouverte pour être fusionnées");
    }

    await this.prisma.orderItem.updateMany({
      where: { orderId: sourceOrder.id },
      data: { orderId: targetOrder.id },
    });

    await this.prisma.order.update({
      where: { id: sourceOrder.id },
      data: { status: "closed" },
    });

    const updatedSource = await this.prisma.table.update({
      where: { id: sourceTableId },
      data: { alert: false },
    });

    const updatedTargetOrder = await this.prisma.order.findUnique({
      where: { id: targetOrder.id },
      include: { items: true, table: true },
    });

    return {
      closedOrderId: sourceOrder.id,
      targetOrder: updatedTargetOrder,
      sourceTable: updatedSource,
      targetTable,
      sourceNumber: sourceTable.number,
      targetNumber: targetTable.number,
      server: targetOrder.server,
    };
  }
}
