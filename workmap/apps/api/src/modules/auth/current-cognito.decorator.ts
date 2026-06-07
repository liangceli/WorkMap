import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { CognitoJwtPayload } from "@workmap/auth";

export const COGNITO_CONTEXT_KEY = Symbol("workmapCognitoContext");

export type RequestWithCognitoContext = {
  [COGNITO_CONTEXT_KEY]?: CognitoJwtPayload;
};

export const CurrentCognito = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithCognitoContext>();
  return request[COGNITO_CONTEXT_KEY];
});
