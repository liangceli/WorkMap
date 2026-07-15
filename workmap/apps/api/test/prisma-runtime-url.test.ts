import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeDatabaseUrl } from "../src/modules/prisma/prisma.service.js";

test("Supabase transaction pooler receives bounded Prisma-compatible runtime parameters", () => {
  const value = resolveRuntimeDatabaseUrl("postgresql://user:example-password@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require");
  const url = new URL(value);
  assert.equal(url.port, "6543");
  assert.equal(url.searchParams.get("pgbouncer"), "true");
  assert.equal(url.searchParams.get("connection_limit"), "4");
  assert.equal(url.searchParams.get("pool_timeout"), "30");
  assert.equal(url.searchParams.get("sslmode"), "require");
});

test("explicit pool values and non-transaction URLs are preserved", () => {
  const configured = "postgresql://user:example-password@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=4&pool_timeout=8";
  assert.equal(resolveRuntimeDatabaseUrl(configured), configured);
  const session = "postgresql://user:example-password@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";
  assert.equal(resolveRuntimeDatabaseUrl(session), session);
  assert.equal(resolveRuntimeDatabaseUrl("not-a-database-url"), "not-a-database-url");
});
