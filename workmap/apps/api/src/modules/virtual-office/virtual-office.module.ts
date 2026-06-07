import { Module } from "@nestjs/common";
import { VirtualOfficeController } from "./virtual-office.controller.js";
import { VirtualOfficeRealtimeGateway } from "./virtual-office-realtime.gateway.js";
import { VirtualOfficeService } from "./virtual-office.service.js";

@Module({
  controllers: [VirtualOfficeController],
  providers: [VirtualOfficeService, VirtualOfficeRealtimeGateway],
  exports: [VirtualOfficeService],
})
export class VirtualOfficeModule {}
