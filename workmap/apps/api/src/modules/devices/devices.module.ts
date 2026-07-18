import { Module } from "@nestjs/common";
import { DevicesController } from "./devices.controller.js";
import { DevicesService } from "./devices.service.js";
import { ActivityModule } from "../activity/activity.module.js";
import { DeviceClientController } from "./device-client.controller.js";
import { DeviceCredentialGuard } from "./device-credential.guard.js";
import { DevicePairingService } from "./device-pairing.service.js";
import { TrackingV2PolicyService } from "./tracking-v2-policy.service.js";
import { TrackingV2ReconciliationService } from "./tracking-v2-reconciliation.service.js";
import { TrackingV2ReconciliationWorker } from "./tracking-v2-reconciliation.worker.js";
import { TrackingV2SyncService } from "./tracking-v2-sync.service.js";

@Module({
  imports: [ActivityModule],
  controllers: [DevicesController, DeviceClientController],
  providers: [
    DevicesService,
    DevicePairingService,
    DeviceCredentialGuard,
    TrackingV2PolicyService,
    TrackingV2ReconciliationService,
    TrackingV2ReconciliationWorker,
    TrackingV2SyncService,
  ],
  exports: [
    DevicesService,
    DevicePairingService,
    TrackingV2ReconciliationService,
  ],
})
export class DevicesModule {}
