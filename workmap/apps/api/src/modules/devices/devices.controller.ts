import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { DevicesService } from "./devices.service.js";

@Controller("devices")
@UseGuards(RequestContextGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  listDevices(@CurrentContext() context: RequestContext) {
    return this.devices.listVisibleDevices(context);
  }

  @Post("register")
  registerDevice(@CurrentContext() context: RequestContext, @Body() body: unknown) {
    return this.devices.registerDevice(context, body);
  }

  @Post("heartbeat")
  heartbeat(@CurrentContext() context: RequestContext, @Body() body: unknown) {
    return this.devices.recordHeartbeat(context, body);
  }
}
