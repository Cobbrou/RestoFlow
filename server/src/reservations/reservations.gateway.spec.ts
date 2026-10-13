import { describe, it, expect, vi } from "vitest";
import { ReservationsGateway } from "./reservations.gateway";
import { permRooms, SENSITIVE, STAFF_ROOM } from "../auth/guards/ws-auth.guard";

const reservation = { id: "r1", customerName: "Martin", phone: "0612345678", email: "m@exemple.fr", guests: 2 };

const makeServer = () => {
  const sent: { rooms: string[]; except: string[]; event: string; data: any }[] = [];
  const target = (rooms: string | string[], except: string[] = []) => ({
    except: (ex: string[]) => target(rooms, ex),
    emit: (event: string, data: any) => sent.push({ rooms: [rooms].flat(), except, event, data }),
  });
  return { server: { to: (rooms: string | string[]) => target(rooms) } as any, sent };
};

describe("Réservations : coordonnées des clients", () => {
  it("téléphone et e-mail ne partent qu'aux postes qui gèrent les réservations", async () => {
    const service: any = {
      create: vi.fn().mockResolvedValue(reservation),
      updateStatus: vi.fn().mockResolvedValue(reservation),
      assignTable: vi.fn().mockResolvedValue(reservation),
    };
    const gateway = new ReservationsGateway(service);
    const { server, sent } = makeServer();
    gateway.server = server;

    await gateway.create(reservation);
    await gateway.updateStatus({ id: "r1", status: "seated" });
    await gateway.assignTable({ id: "r1", tableId: "t1" });

    const allowed = permRooms(SENSITIVE.reservationContacts);
    expect(sent).toHaveLength(6);
    for (const msg of sent) {
      if (msg.rooms.includes(STAFF_ROOM)) {
        expect(msg.except).toEqual(allowed);
        expect(msg.data).toEqual({ id: "r1", customerName: "Martin", guests: 2 });
      } else {
        expect(msg.rooms).toEqual(allowed);
        expect(msg.data).toEqual(reservation);
      }
    }
  });
});
