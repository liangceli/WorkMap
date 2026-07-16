import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

export function resolveRuntimeDatabaseUrl(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) return undefined;

  try {
    const url = new URL(databaseUrl);
    if (!url.hostname.endsWith(".pooler.supabase.com")) return databaseUrl;

    if (url.port === "5432") {
      // Supabase session poolers cap concurrent client sessions. One Prisma
      // connection keeps a single Render instance from consuming that cap.
      if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
      if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "30");
      return url.toString();
    }

    if (url.port !== "6543") return databaseUrl;

    if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "2");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "30");
    return url.toString();
  } catch {
    return databaseUrl;
  }
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
