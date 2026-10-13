import { describe, it, expect, vi } from "vitest";
import { WebsocketGateway } from "./websocket.gateway";

const makeGateway = (deps: { config?: any; printer?: any } = {}) =>
  new WebsocketGateway(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    deps.config ?? ({} as any),
    {} as any,
    {} as any,
    deps.printer ?? ({} as any),
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

describe("Impression directe depuis un poste", () => {
  const setup = () => {
    const printer = { sendRaw: vi.fn().mockResolvedValue({ success: true }), testPrinter: vi.fn().mockResolvedValue({ success: true }) };
    const config = { getConfig: async () => ({ printers: [{ ip: "192.168.1.50", port: 9101 }, { name: "USB" }] }) };
    return { printer, gateway: makeGateway({ config, printer }) };
  };

  it("utilise le port configuré, jamais celui fourni par le client", async () => {
    const { printer, gateway } = setup();
    await gateway.handlePrinterSendRaw({ ip: "192.168.1.50", port: 22, buffer: [0x1b, 0x40] } as any);
    await gateway.handlePrinterTest({ ip: "192.168.1.50", port: 22 } as any);
    expect(printer.sendRaw).toHaveBeenCalledWith("192.168.1.50", 9101, Buffer.from([0x1b, 0x40]));
    expect(printer.testPrinter).toHaveBeenCalledWith("192.168.1.50", 9101);
  });

  it("refuse une IP absente de la configuration", async () => {
    const { printer, gateway } = setup();
    expect(await gateway.handlePrinterSendRaw({ ip: "127.0.0.1", buffer: [] })).toMatchObject({ success: false });
    expect(await gateway.handlePrinterSendRaw({ ip: undefined as any, buffer: [] })).toMatchObject({ success: false });
    expect(printer.sendRaw).not.toHaveBeenCalled();
  });
});
