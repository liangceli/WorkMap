import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { DevicesService } from "./devices.service.js";
import { DevicePairingService } from "./device-pairing.service.js";

@Controller("devices")
@UseGuards(RequestContextGuard)
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly pairing: DevicePairingService,
  ) {}

  @Get()
  listDevices(@CurrentContext() context: RequestContext) {
    return this.devices.listVisibleDevices(context);
  }

  @Get("workstations")
  listWorkstations(@CurrentContext() context: RequestContext) {
    return this.pairing.listWorkstations(context);
  }

  @Post("register")
  registerDevice(@CurrentContext() context: RequestContext, @Body() body: unknown) {
    return this.devices.registerDevice(context, body);
  }

  @Post("heartbeat")
  heartbeat(@CurrentContext() context: RequestContext, @Body() body: unknown) {
    return this.devices.recordHeartbeat(context, body);
  }

  @Post("pairing-codes")
  createPairingCode(@CurrentContext() context: RequestContext, @Body() body: unknown) {
    return this.pairing.createPairingCode(context, body);
  }

  @Get("pairing-codes/:pairingId")
  pairingStatus(@CurrentContext() context: RequestContext, @Param("pairingId", ParseUUIDPipe) pairingId: string) {
    return this.pairing.getPairingStatus(context, pairingId);
  }

  @Post(":deviceId/revoke")
  revokeDevice(@CurrentContext() context: RequestContext, @Param("deviceId", ParseUUIDPipe) deviceId: string) {
    return this.pairing.revokeDevice(context, deviceId);
  }
}
