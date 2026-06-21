import type { VirtualOfficeReaction } from "@workmap/shared-types";
import { workMapApiGet, workMapApiPatch, workMapApiPost } from "./apiClient";
import type { ApiClientOptions, WorkMapApiNotice, WorkMapApiNoticeList } from "./apiTypes";

export function listNotices(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiNoticeList>("/notices", options);
}

export function createNoticeInteraction(
  body:
    | { targetUserId: string; type: "MESSAGE"; message: string }
    | { targetUserId: string; type: "WAVE" }
    | { targetUserId: string; type: "REACTION"; reaction: VirtualOfficeReaction },
  options?: ApiClientOptions,
) {
  return workMapApiPost<WorkMapApiNotice>("/notices/interactions", body, options);
}

export function markNoticesRead(options?: ApiClientOptions) {
  return workMapApiPatch<{ updatedCount: number; readAt: string }>("/notices/read", undefined, options);
}
