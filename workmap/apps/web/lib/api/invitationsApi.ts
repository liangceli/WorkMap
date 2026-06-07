import { workMapApiGet, workMapApiPost } from "./apiClient";
import type {
  ApiClientOptions,
  WorkMapApiCreateInvitationResponse,
  WorkMapApiInvitationList,
  WorkMapApiWorkspaceContext,
} from "./apiTypes";

export function listInvitations(options?: ApiClientOptions) {
  return workMapApiGet<WorkMapApiInvitationList>("/invitations", options);
}

export function createInvitation(
  body: {
    email: string;
    role: string;
  },
  options?: ApiClientOptions,
) {
  return workMapApiPost<WorkMapApiCreateInvitationResponse>("/invitations", body, options);
}

export function acceptInvitation(body: { token: string; displayName: string }, options?: ApiClientOptions) {
  return workMapApiPost<WorkMapApiWorkspaceContext>("/invitations/accept", body, options);
}
