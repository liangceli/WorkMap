import { Module } from "@nestjs/common";
import { VirtualOfficeService } from "./virtual-office.service.js";

@Module({
  providers: [VirtualOfficeService],
  exports: [VirtualOfficeService],
})
export class VirtualOfficeModule {}
