import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RequestContext, WorkMapRole } from "@workmap/auth";
import { REQUEST_CONTEXT_KEY, type RequestWithContext } from "./current-context.decorator.js";
import { ROLES_KEY } from "./roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const allowedRoles = this.reflector.getAllAndOverride<WorkMapRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!allowedRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const requestContext = request[REQUEST_CONTEXT_KEY] as RequestContext | undefined;

    if (!requestContext || !allowedRoles.includes(requestContext.role)) {
      throw new ForbiddenException("Insufficient WorkMap role.");
    }

    return true;
  }
}
