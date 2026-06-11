import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "workmap-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("readiness")
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ready",
        service: "workmap-api",
        checks: {
          database: "ok",
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: "not_ready",
        service: "workmap-api",
        checks: {
          database: "unavailable",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
