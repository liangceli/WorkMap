import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from "@nestjs/common";
import { DeviceClientType } from "@prisma/client";
import type { RequestContext } from "@workmap/auth";
import { ActivityService } from "../activity/activity.service.js";
import { CurrentDeviceContext, type DeviceRequestContext } from "./device-context.js";
import { DeviceCredentialGuard } from "./device-credential.guard.js";
import { DevicePairingService } from "./device-pairing.service.js";
import { DevicesService } from "./devices.service.js";

@Controller("device-client")
export class DeviceClientController {
  constructor(
    private readonly pairing: DevicePairingService,
    private readonly devices: DevicesService,
    private readonly activity: ActivityService,
  ) {}

  @Post("pair")
  pair(@Body() body: unknown) {
    return this.pairing.exchangePairingCode(body);
  }

  @Get("status")
  @UseGuards(DeviceCredentialGuard)
  status(@CurrentDeviceContext() context: DeviceRequestContext) {
    return { paired: true, clientType: context.clientType, deviceId: context.deviceId };
  }

  @Post("heartbeat")
  @UseGuards(DeviceCredentialGuard)
  heartbeat(@CurrentDeviceContext() context: DeviceRequestContext, @Body() body: unknown) {
    return this.devices.recordHeartbeat(toRequestContext(context), { ...readBody(body), deviceId: context.deviceId });
  }

  @Post("session/start")
  @UseGuards(DeviceCredentialGuard)
  startSession(@CurrentDeviceContext() context: DeviceRequestContext, @Body() body: unknown) {
    assertClientType(context, DeviceClientType.DESKTOP_AGENT);
    return this.devices.startAgentSession(toRequestContext(context), { ...readBody(body), deviceId: context.deviceId });
  }

  @Post("session/stop")
  @UseGuards(DeviceCredentialGuard)
  stopSession(@CurrentDeviceContext() context: DeviceRequestContext, @Body() body: unknown) {
    assertClientType(context, DeviceClientType.DESKTOP_AGENT);
    return this.devices.stopAgentSession(toRequestContext(context), { ...readBody(body), deviceId: context.deviceId });
  }

  @Post("app-usage")
  @UseGuards(DeviceCredentialGuard)
  appUsage(@CurrentDeviceContext() context: DeviceRequestContext, @Body() body: unknown) {
    assertClientType(context, DeviceClientType.DESKTOP_AGENT);
    return this.activity.ingestAppUsage(toRequestContext(context), bindDevice(body, context.deviceId));
  }

  @Post("domain-usage")
  @UseGuards(DeviceCredentialGuard)
  domainUsage(@CurrentDeviceContext() context: DeviceRequestContext, @Body() body: unknown) {
    assertClientType(context, DeviceClientType.BROWSER_EXTENSION);
    return this.activity.ingestDomainUsage(toRequestContext(context), bindDevice(body, context.deviceId));
  }
}

function toRequestContext(context: DeviceRequestContext): RequestContext {
  return { companyId: context.companyId, userId: context.userId, role: context.role };
}

function assertClientType(context: DeviceRequestContext, expected: DeviceClientType) {
  if (context.clientType !== expected) {
    throw new ForbiddenException(`Device credential is not authorised for ${expected}.`);
  }
}

function readBody(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function bindDevice(value: unknown, deviceId: string) {
  const body = readBody(value);
  if (Array.isArray(body.events)) {
    return { ...body, events: body.events.map((event) => ({ ...readBody(event), deviceId })) };
  }
  return { ...body, deviceId };
}
