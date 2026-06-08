import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { PlatformRequestContext } from "@workmap/auth";

export const PLATFORM_REQUEST_CONTEXT_KEY = "workmapPlatformRequestContext";

export type RequestWithPlatformContext = {
  [PLATFORM_REQUEST_CONTEXT_KEY]?: PlatformRequestContext;
};

export const CurrentPlatformContext = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithPlatformContext>();
  return request[PLATFORM_REQUEST_CONTEXT_KEY];
});
