import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { REQUEST_CONTEXT_KEY, type RequestWithContext } from "./current-context.decorator.js";
import { RequestContextResolverService } from "./request-context-resolver.service.js";

type HeaderRequest = RequestWithContext & {
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class RequestContextGuard implements CanActivate {
  constructor(private readonly contextResolver: RequestContextResolverService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HeaderRequest>();
    request[REQUEST_CONTEXT_KEY] = await this.contextResolver.resolveHttpHeaders(request.headers);

    return true;
  }
}
