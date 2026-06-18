import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { DEVICE_CONTEXT_KEY, type RequestWithDeviceContext } from "./device-context.js";
import { DevicePairingService } from "./device-pairing.service.js";

@Injectable()
export class DeviceCredentialGuard implements CanActivate {
  constructor(private readonly pairing: DevicePairingService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithDeviceContext>();
    const authorization = readHeader(request.headers?.authorization);
    request[DEVICE_CONTEXT_KEY] = await this.pairing.resolveDeviceAuthorization(authorization);
    return true;
  }
}

function readHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
