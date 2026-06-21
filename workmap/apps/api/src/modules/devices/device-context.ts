import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { WorkMapRole } from "@workmap/auth";
import type { DeviceClientType } from "@prisma/client";

export const DEVICE_CONTEXT_KEY = "workmapDeviceContext";

export type DeviceRequestContext = {
  companyId: string;
  userId: string;
  role: WorkMapRole;
  deviceId: string;
  credentialId: string;
  clientType: DeviceClientType;
};

export type RequestWithDeviceContext = {
  headers?: Record<string, string | string[] | undefined>;
  [DEVICE_CONTEXT_KEY]?: DeviceRequestContext;
};

export const CurrentDeviceContext = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithDeviceContext>();
  return request[DEVICE_CONTEXT_KEY];
});
