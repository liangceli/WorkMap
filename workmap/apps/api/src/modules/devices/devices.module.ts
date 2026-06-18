import { Module } from "@nestjs/common";
import { DevicesController } from "./devices.controller.js";
import { DevicesService } from "./devices.service.js";
import { ActivityModule } from "../activity/activity.module.js";
import { DeviceClientController } from "./device-client.controller.js";
import { DeviceCredentialGuard } from "./device-credential.guard.js";
import { DevicePairingService } from "./device-pairing.service.js";

@Module({
  imports: [ActivityModule],
  controllers: [DevicesController, DeviceClientController],
  providers: [DevicesService, DevicePairingService, DeviceCredentialGuard],
  exports: [DevicesService, DevicePairingService],
})
export class DevicesModule {}
