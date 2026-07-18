import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { DevicesModule } from "../devices/devices.module.js";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";
import { TrackingV2ReportsService } from "./tracking-v2-reports.service.js";

@Module({
  imports: [AuditModule, DevicesModule],
  controllers: [ReportsController],
  providers: [ReportsService, TrackingV2ReportsService],
})
export class ReportsModule {}
