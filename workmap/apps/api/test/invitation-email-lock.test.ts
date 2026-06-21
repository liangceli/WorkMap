/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { InvitationStatus } from "@prisma/client";
import type { RequestContext } from "@workmap/auth";
import { InvitationsService } from "../src/modules/invitations/invitations.service.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";

const ownerContext: RequestContext = {
  companyId: COMPANY_ID,
  userId: OWNER_ID,
  role: "OWNER",
};

test("invite preview exposes the locked email and accept rejects a different verified Cognito email", async () => {
  const prisma = new InvitationPrisma();
  const invitations = new InvitationsService(prisma as any);
  const created = await invitations.create(ownerContext, {
    email: "Employee@Example.com",
    role: "EMPLOYEE",
  });

  const preview = await invitations.preview(created.token);
  assert.equal(preview.invitedEmail, "employee@example.com");
  assert.equal(preview.status, InvitationStatus.PENDING);
  assert.equal(preview.company.name, "WorkMap Test");

  await assert.rejects(
    () =>
      invitations.accept(
        {
          sub: "wrong-cognito-sub",
          email: "other@example.com",
          email_verified: true,
        } as any,
        {
          token: created.token,
          displayName: "Other Employee",
        },
      ),
    ForbiddenException,
  );
});

class InvitationPrisma {
  invitations: any[] = [];
  company = {
    id: COMPANY_ID,
    name: "WorkMap Test",
    slug: "workmap-test",
  };
  owner = {
    id: OWNER_ID,
    displayName: "Owner",
    email: "owner@example.com",
  };

  invitation = {
    create: async ({ data }: any) => {
      const row = {
        id: crypto.randomUUID(),
        acceptedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        invitedBy: this.owner,
        company: this.company,
        ...data,
      };
      this.invitations.push(row);
      return row;
    },
    findUnique: async ({ where }: any) => {
      const row = this.invitations.find((item) => item.tokenHash === where.tokenHash) ?? null;
      return row ? { ...row, company: this.company } : null;
    },
    update: async ({ where, data }: any) => {
      const row = this.invitations.find((item) => item.id === where.id);
      if (!row) {
        throw new Error("Invitation not found.");
      }

      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
  };

  user = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async () => {
      throw new Error("User creation should not run for mismatched invitation email.");
    },
    update: async () => {
      throw new Error("User update should not run for mismatched invitation email.");
    },
  };

  async $transaction(input: any) {
    return typeof input === "function" ? input(this) : Promise.all(input);
  }
}
