import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { NoticeType } from "@prisma/client";
import type { PrismaService } from "../src/modules/prisma/prisma.service.js";
import { NoticesService } from "../src/modules/notices/notices.service.js";

const context = {
  companyId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  role: "EMPLOYEE" as const,
};
const recipient = {
  id: "33333333-3333-4333-8333-333333333333",
  displayName: "Teammate",
};

test("notice interaction is tenant-scoped and persists a WorkMap message", async () => {
  const created: Array<Record<string, unknown>> = [];
  const service = new NoticesService({
    user: {
      findFirst: async ({ where }: { where: { id: string; companyId: string } }) =>
        where.companyId === context.companyId && where.id === recipient.id ? recipient : null,
    },
    notice: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return {
          id: "44444444-4444-4444-8444-444444444444",
          ...data,
          createdAt: new Date("2026-06-21T00:00:00.000Z"),
          readAt: null,
          actor: { id: context.userId, displayName: "Sender" },
          recipient,
        };
      },
    },
  } as unknown as PrismaService);

  const result = await service.createInteraction(context, {
    targetUserId: recipient.id,
    type: "MESSAGE",
    message: "  Hello   teammate  ",
  });

  assert.equal(created.length, 1);
  assert.equal(created[0]?.companyId, context.companyId);
  assert.equal(created[0]?.actorUserId, context.userId);
  assert.equal(created[0]?.recipientUserId, recipient.id);
  assert.equal(created[0]?.type, NoticeType.MESSAGE);
  assert.equal(created[0]?.message, "Hello teammate");
  assert.equal(result.direction, "sent");
});

test("notice interaction rejects a user outside the current tenant", async () => {
  const service = new NoticesService({
    user: { findFirst: async () => null },
  } as unknown as PrismaService);

  await assert.rejects(
    () => service.createInteraction(context, { targetUserId: recipient.id, type: "WAVE" }),
    NotFoundException,
  );
});

test("mark all read only updates the current recipient inside the tenant", async () => {
  let where: Record<string, unknown> | undefined;
  const service = new NoticesService({
    notice: {
      updateMany: async (input: { where: Record<string, unknown> }) => {
        where = input.where;
        return { count: 2 };
      },
    },
  } as unknown as PrismaService);

  const result = await service.markAllRead(context);

  assert.deepEqual(where, {
    companyId: context.companyId,
    recipientUserId: context.userId,
    readAt: null,
  });
  assert.equal(result.updatedCount, 2);
});
