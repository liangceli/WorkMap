import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { CognitoJwtService } from "./cognito-jwt.service.js";
import { COGNITO_CONTEXT_KEY, type RequestWithCognitoContext } from "./current-cognito.decorator.js";

type HeaderRequest = RequestWithCognitoContext & {
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class CognitoOnlyGuard implements CanActivate {
  constructor(private readonly cognitoJwt: CognitoJwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HeaderRequest>();
    const payload = await this.cognitoJwt.verifyBearerToken(singleHeader(request.headers.authorization));

    if (!payload) {
      throw new UnauthorizedException("Cognito bearer token is required.");
    }

    request[COGNITO_CONTEXT_KEY] = payload;
    return true;
  }
}

function singleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
