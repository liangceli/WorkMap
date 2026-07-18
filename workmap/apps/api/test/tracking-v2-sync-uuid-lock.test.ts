import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { uuidListForRawQuery } from "../src/modules/devices/tracking-v2-sync.service.js";

test("v2 write-lane lock casts raw lane identifiers to UUID", () => {
  const laneIds = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];
  const query = Prisma.sql`
    SELECT "id"
    FROM "ClientWriteLane"
    WHERE "id" IN (${uuidListForRawQuery(laneIds)})
    FOR UPDATE
  `;

  assert.deepEqual(query.values, laneIds);
  assert.match(
    query.strings.join("$parameter"),
    /CAST\(\$parameter AS uuid\).*CAST\(\$parameter AS uuid\)/s,
  );
});
