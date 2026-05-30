import { Controller, Get, UseGuards } from "@nestjs/common";
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
}
