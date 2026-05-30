import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { WorkMapJwtPayload } from "@workmap/auth";

const JWT_ALGORITHM = "HS256";
const JWT_TYPE = "JWT";

@Injectable()
export class JwtService {
  signPayload(payload: WorkMapJwtPayload) {
    const secret = process.env.WORKMAP_JWT_SECRET;

    if (!secret) {
      throw new UnauthorizedException("WORKMAP_JWT_SECRET is not configured.");
    }

    const encodedHeader = encodeJson({ alg: JWT_ALGORITHM, typ: JWT_TYPE });
    const encodedPayload = encodeJson(payload);
    const encodedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  verifyBearerToken(authorizationHeader: string | undefined): WorkMapJwtPayload | null {
    const token = parseBearerToken(authorizationHeader);

    if (!token) {
      return null;
    }

    const secret = process.env.WORKMAP_JWT_SECRET;

    if (!secret) {
      throw new UnauthorizedException("WORKMAP_JWT_SECRET is not configured.");
    }

    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException("Invalid bearer token.");
    }

    const header = decodeJson<{ alg?: string; typ?: string }>(encodedHeader);

    if (header.alg !== JWT_ALGORITHM) {
      throw new UnauthorizedException("Unsupported bearer token algorithm.");
    }

    const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);

    if (!safeEqual(encodedSignature, expectedSignature)) {
      throw new UnauthorizedException("Invalid bearer token signature.");
    }

    const payload = decodeJson<WorkMapJwtPayload>(encodedPayload);
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || !payload.companyId) {
      throw new UnauthorizedException("Bearer token is missing WorkMap claims.");
    }

    if (payload.exp && payload.exp <= now) {
      throw new UnauthorizedException("Bearer token has expired.");
    }

    return payload;
  }
}

function encodeJson(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
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
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as T;
  } catch {
    throw new UnauthorizedException("Invalid bearer token payload.");
  }
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
