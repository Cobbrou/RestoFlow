import { describe, it, expect } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { MESSAGE_METADATA } from "@nestjs/websockets/constants";
import { WebsocketGateway } from "./websocket.gateway";
import { ManagementGateway } from "../management/management.gateway";
import { ReservationsGateway } from "../reservations/reservations.gateway";
import { ScalarIdsGuard } from "../auth/guards/scalar-ids.guard";
import { WsAuthGuard } from "../auth/guards/ws-auth.guard";
import { WsPermissionsGuard } from "../auth/guards/ws-permissions.guard";
import { IS_PUBLIC_KEY } from "../auth/decorators/public.decorator";
import { PERMISSIONS_KEY } from "../auth/decorators/permissions.decorator";

const GATEWAYS: any[] = [WebsocketGateway, ManagementGateway, ReservationsGateway];

const handlersOf = (gateway: any) =>
  Object.getOwnPropertyNames(gateway.prototype)
    .map((name) => Object.getOwnPropertyDescriptor(gateway.prototype, name)!.value)
    .filter((handler) => typeof handler === "function" && Reflect.getMetadata(MESSAGE_METADATA, handler));

describe("Sécurité des gateways temps réel", () => {
  it("chaque gateway contrôle les identifiants, la session puis les permissions", () => {
    for (const gateway of GATEWAYS) {
      expect(Reflect.getMetadata(GUARDS_METADATA, gateway)).toEqual([ScalarIdsGuard, WsAuthGuard, WsPermissionsGuard]);
    }
  });

  it("chaque action déclare @RequirePermissions (sur l'action ou la gateway) ou @Public", () => {
    const undeclared = GATEWAYS.flatMap((gateway) =>
      handlersOf(gateway)
        .filter(
          (handler) =>
            !Reflect.getMetadata(IS_PUBLIC_KEY, handler) &&
            !(Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? Reflect.getMetadata(PERMISSIONS_KEY, gateway))?.length
        )
        .map((handler) => Reflect.getMetadata(MESSAGE_METADATA, handler))
    );
    expect(undeclared).toEqual([]);
    expect(GATEWAYS.flatMap(handlersOf).length).toBeGreaterThan(50);
  });
});
