import { Module } from "@nestjs/common";
import { VirtualOfficeController } from "./virtual-office.controller.js";
import { VirtualOfficeService } from "./virtual-office.service.js";

@Module({
  controllers: [VirtualOfficeController],
  providers: [VirtualOfficeService],
  exports: [VirtualOfficeService],
})
export class VirtualOfficeModule {}
