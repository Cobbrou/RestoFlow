import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const STATUSES = ["confirmed", "seated", "cancelled", "no_show"];

@Injectable()
export class ReservationsService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    const customerName = String(data?.customerName || "").trim();
    if (!customerName) throw new BadRequestException("Nom du client obligatoire");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.date || "") || !/^\d{2}:\d{2}$/.test(data?.time || "")) {
      throw new BadRequestException("Date ou heure de réservation invalide");
    }
    return this.prisma.reservation.create({
      data: {
        id: data.id || `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        customerName,
        phone: String(data.phone || ""),
        email: data.email || null,
        date: data.date,
        time: data.time,
        guests: Math.max(1, Number(data.guests) || 2),
        status: STATUSES.includes(data.status) ? data.status : "confirmed",
        tableId: data.tableId || null,
        notes: data.notes || null,
      },
    });
  }

  updateStatus(id: string, status: string) {
    if (!STATUSES.includes(status)) throw new BadRequestException("Statut de réservation invalide");
    return this.prisma.reservation.update({ where: { id }, data: { status } });
  }

  assignTable(id: string, tableId: string | null) {
    return this.prisma.reservation.update({ where: { id }, data: { tableId: tableId || null } });
  }

  remove(id: string) {
    return this.prisma.reservation.delete({ where: { id } });
  }
}
