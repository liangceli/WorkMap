import type { ApiResult, WorkMapApiRequestContext } from "../api/apiTypes";

/**
 * Only a backend-confirmed missing WorkMap mapping may enter owner onboarding.
 * Transport, database, and token-refresh failures must never look like a new user.
 */
export function isConfirmedWorkspaceMissing(result: ApiResult<WorkMapApiRequestContext>) {
  if (result.ok) return false;

  if (result.status === 404) return true;
  return result.status === 401 && /not mapped to an active workmap user/i.test(result.error);
}

export function workspaceAccessError(result: ApiResult<unknown>) {
  if (result.ok) return "";
  return `${result.error} Your existing workspace was not changed. Please retry after the WorkMap API is available.`;
}
