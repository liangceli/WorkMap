import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const DEFAULT_SESSION_POOL_CONNECTION_LIMIT = 8;
const DEFAULT_RUNTIME_POOL_TIMEOUT_SECONDS = 10;
const MAX_RUNTIME_CONNECTION_LIMIT = 16;

export function resolveRuntimeDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) return undefined;

  try {
    const url = new URL(databaseUrl);
    if (!url.hostname.endsWith(".pooler.supabase.com")) return databaseUrl;

    if (url.port === "5432") {
      // Keep enough headroom for Render's overlapping deploy instances and
      // operational connections while allowing report aggregates to run in parallel.
      applyRuntimeConnectionLimit(url, DEFAULT_SESSION_POOL_CONNECTION_LIMIT);
      applyRuntimePoolTimeout(url);
      return url.toString();
    }

    if (url.port !== "6543") return databaseUrl;

    if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
    applyRuntimeConnectionLimit(url, 2);
    applyRuntimePoolTimeout(url);
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function applyRuntimePoolTimeout(url: URL) {
  // A sync request must fail before the Tracking v2 client's 60-second
  // transport envelope. Keeping Prisma's v6 default prevents several queued
  // database acquisitions from surviving a disconnected client and
  // amplifying a transient database outage into a request backlog.
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", `${DEFAULT_RUNTIME_POOL_TIMEOUT_SECONDS}`);
  }
}

function applyRuntimeConnectionLimit(url: URL, fallback: number) {
  const configured = parseRuntimeConnectionLimit(process.env.WORKMAP_PRISMA_CONNECTION_LIMIT);
  if (configured !== null) {
    url.searchParams.set("connection_limit", `${configured}`);
  } else if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", `${fallback}`);
  }
}

function parseRuntimeConnectionLimit(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_RUNTIME_CONNECTION_LIMIT ? parsed : null;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const runtimeDatabaseUrl = resolveRuntimeDatabaseUrl();
    super(runtimeDatabaseUrl ? { datasources: { db: { url: runtimeDatabaseUrl } } } : undefined);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async connectAfterStartup() {
    try {
      await this.connectWithRetry();
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown database connection error";
      this.logger.warn(`Database remains unavailable after startup retry: ${message}`);
    }
  }

  private async connectWithRetry() {
    const attempts = 3;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (attempt === attempts || !isTransientDatabaseConnectionError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }
}

function isTransientDatabaseConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /max clients reached|connection pool timeout|can't reach database server|connection.*timed out/i.test(message);
}
