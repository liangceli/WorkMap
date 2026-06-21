import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { NoticeType } from "@prisma/client";
import type { RequestContext } from "@workmap/auth";
import type { VirtualOfficeReaction } from "@workmap/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";

const reactions = new Set<VirtualOfficeReaction>(["wave", "heart", "party", "thumbs_up", "laugh", "clap", "hundred", "fire"]);

@Injectable()
export class NoticesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: RequestContext) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notice.findMany({
        where: {
          companyId: context.companyId,
          OR: [{ actorUserId: context.userId }, { recipientUserId: context.userId }],
        },
        include: {
          actor: { select: { id: true, displayName: true } },
          recipient: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.notice.count({
        where: {
          companyId: context.companyId,
          recipientUserId: context.userId,
          readAt: null,
        },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        direction: item.actorUserId === context.userId ? "sent" : "received",
        actor: item.actor,
        recipient: item.recipient,
        message: item.message,
        reaction: item.reaction,
        createdAt: item.createdAt.toISOString(),
        readAt: item.readAt?.toISOString() ?? null,
      })),
      unreadCount,
    };
  }

  async createInteraction(context: RequestContext, input: unknown) {
    const parsed = parseInteraction(input);
    const recipient = await this.prisma.user.findFirst({
      where: { id: parsed.targetUserId, companyId: context.companyId },
      select: { id: true, displayName: true },
    });

    if (!recipient) {
      throw new NotFoundException("Notice recipient was not found in this workspace.");
    }

    if (recipient.id === context.userId) {
      throw new BadRequestException("Notice recipient must be another workspace user.");
    }

    const notice = await this.prisma.notice.create({
      data: {
        companyId: context.companyId,
        actorUserId: context.userId,
        recipientUserId: recipient.id,
        type: parsed.type,
        message: parsed.message,
        reaction: parsed.reaction,
      },
      include: {
        actor: { select: { id: true, displayName: true } },
        recipient: { select: { id: true, displayName: true } },
      },
    });

    return {
      id: notice.id,
      type: notice.type,
      direction: "sent",
      actor: notice.actor,
      recipient: notice.recipient,
      message: notice.message,
      reaction: notice.reaction,
      createdAt: notice.createdAt.toISOString(),
      readAt: notice.readAt?.toISOString() ?? null,
    };
  }

  async markAllRead(context: RequestContext) {
    const readAt = new Date();
    const result = await this.prisma.notice.updateMany({
      where: {
        companyId: context.companyId,
        recipientUserId: context.userId,
        readAt: null,
      },
      data: { readAt },
    });

    return { updatedCount: result.count, readAt: readAt.toISOString() };
  }
}

function parseInteraction(input: unknown): {
  targetUserId: string;
  type: NoticeType;
  message?: string;
  reaction?: VirtualOfficeReaction;
} {
  if (!isRecord(input) || typeof input.targetUserId !== "string") {
    throw new BadRequestException("A target workspace user is required.");
  }

  if (input.type === "MESSAGE") {
    const message = typeof input.message === "string" ? input.message.replace(/\s+/g, " ").trim() : "";
    if (!message || message.length > 500) {
      throw new BadRequestException("Message must be between 1 and 500 characters.");
    }
    return { targetUserId: input.targetUserId, type: NoticeType.MESSAGE, message };
  }

  if (input.type === "WAVE") {
    return { targetUserId: input.targetUserId, type: NoticeType.WAVE };
  }

  if (input.type === "REACTION" && typeof input.reaction === "string" && reactions.has(input.reaction as VirtualOfficeReaction)) {
    return { targetUserId: input.targetUserId, type: NoticeType.REACTION, reaction: input.reaction as VirtualOfficeReaction };
  }

  throw new BadRequestException("Notice interaction type is invalid.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
