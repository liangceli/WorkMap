import { SetMetadata } from "@nestjs/common";
import type { WorkMapRole } from "@workmap/auth";

export const ROLES_KEY = "workmapRoles";

export function Roles(...roles: WorkMapRole[]) {
  return SetMetadata(ROLES_KEY, roles);
}
