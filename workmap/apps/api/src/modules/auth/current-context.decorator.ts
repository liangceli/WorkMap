import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";

export const REQUEST_CONTEXT_KEY = "workmapRequestContext";

export type RequestWithContext = {
  [REQUEST_CONTEXT_KEY]?: RequestContext;
};

export const CurrentContext = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithContext>();
  return request[REQUEST_CONTEXT_KEY];
});
