import { Injectable, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentCompany(context: RequestContext) {
    const company = await this.prisma.company.findFirst({
      where: { id: context.companyId },
      include: {
        departments: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      departments: company.departments,
    };
  }
}
