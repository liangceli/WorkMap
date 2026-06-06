import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { CognitoJwtPayload } from "@workmap/auth";

type CognitoConfig = {
  issuer: string;
  appClientId: string;
};

type CognitoJwk = {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

type JwksCache = {
  issuer: string;
  keys: CognitoJwk[];
  expiresAt: number;
};

const COGNITO_ALGORITHM = "RS256";
const JWKS_CACHE_MS = 60 * 60 * 1000;

@Injectable()
export class CognitoJwtService {
  private jwksCache: JwksCache | null = null;

  async verifyBearerToken(authorizationHeader: string | undefined): Promise<CognitoJwtPayload | null> {
    const token = parseBearerToken(authorizationHeader);
    const config = getCognitoConfig();

    if (!token || !config) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException("Invalid Cognito bearer token.");
    }

    const header = decodeJson<{ alg?: string; kid?: string; typ?: string }>(encodedHeader);
    const payload = decodeJson<CognitoJwtPayload>(encodedPayload);

    if (payload.iss !== config.issuer) {
      return null;
    }

    if (header.alg !== COGNITO_ALGORITHM || !header.kid) {
      throw new UnauthorizedException("Unsupported Cognito bearer token.");
    }

    validateCognitoClaims(payload, config);
    const key = await this.getSigningKey(config.issuer, header.kid);
    const verified = createVerify("RSA-SHA256")
      .update(`${encodedHeader}.${encodedPayload}`)
      .end()
      .verify(createPublicKey({ key: key as JsonWebKey, format: "jwk" }), Buffer.from(encodedSignature, "base64url"));

    if (!verified) {
      throw new UnauthorizedException("Invalid Cognito bearer token signature.");
    }

    return payload;
  }

  private async getSigningKey(issuer: string, kid: string) {
    const keys = await this.getJwks(issuer);
    const key = keys.find((candidate) => candidate.kid === kid);

    if (!key || key.kty !== "RSA" || !key.n || !key.e) {
      throw new UnauthorizedException("Cognito signing key was not found.");
    }

    return key;
  }

  private async getJwks(issuer: string) {
    const now = Date.now();

    if (this.jwksCache?.issuer === issuer && this.jwksCache.expiresAt > now) {
      return this.jwksCache.keys;
    }

    const response = await fetch(`${issuer}/.well-known/jwks.json`);

    if (!response.ok) {
      throw new UnauthorizedException("Unable to load Cognito signing keys.");
    }

    const body = (await response.json()) as { keys?: unknown };

    if (!Array.isArray(body.keys)) {
      throw new UnauthorizedException("Cognito signing keys response was invalid.");
    }

    const keys = body.keys.filter(isCognitoJwk);
    this.jwksCache = { issuer, keys, expiresAt: now + JWKS_CACHE_MS };

    return keys;
  }
}

function getCognitoConfig(): CognitoConfig | null {
  const configuredIssuer = process.env.WORKMAP_COGNITO_ISSUER?.trim().replace(/\/+$/, "");
  const region = process.env.WORKMAP_COGNITO_REGION?.trim();
  const userPoolId = process.env.WORKMAP_COGNITO_USER_POOL_ID?.trim();
  const appClientId = process.env.WORKMAP_COGNITO_APP_CLIENT_ID?.trim();
  const issuer = configuredIssuer || (region && userPoolId ? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}` : "");

  if (!issuer || !appClientId) {
    return null;
  }

  return { issuer, appClientId };
}

function validateCognitoClaims(payload: CognitoJwtPayload, config: CognitoConfig) {
  const now = Math.floor(Date.now() / 1000);
  const audience = payload.aud ?? payload.client_id;

  if (!payload.sub) {
    throw new UnauthorizedException("Cognito token is missing subject.");
  }

  if (audience !== config.appClientId) {
    throw new UnauthorizedException("Cognito token audience is not allowed.");
  }

  if (payload.exp && payload.exp <= now) {
    throw new UnauthorizedException("Cognito token has expired.");
  }

  if (payload.nbf && payload.nbf > now) {
    throw new UnauthorizedException("Cognito token is not active yet.");
  }
}

function parseBearerToken(header: string | undefined) {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function decodeJson<T>(encoded: string): T {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    throw new UnauthorizedException("Invalid Cognito bearer token payload.");
  }
}

function isCognitoJwk(value: unknown): value is CognitoJwk {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CognitoJwk).kid === "string" &&
    typeof (value as CognitoJwk).kty === "string" &&
    typeof (value as CognitoJwk).n === "string" &&
    typeof (value as CognitoJwk).e === "string"
  );
}
