import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAgentStatus, writeJsonAtomic } from "../src/fileStore.js";
import type { AgentStatus } from "../src/types.js";

test("atomic JSON writes retry a transient Windows rename lock with a fresh temp file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workmap-agent-file-store-test-"));
  const filePath = join(directory, "status.json");
  const tempNames: string[] = [];
  let renameCalls = 0;

  try {
    await writeJsonAtomic(filePath, { ok: true }, {
      retryDelayMs: 0,
      tempName: () => {
        const tempName = `.status.${tempNames.length + 1}.tmp`;
        tempNames.push(tempName);
        return tempName;
      },
      renameImpl: async (from, to) => {
        renameCalls += 1;
        if (renameCalls === 1) {
          throw Object.assign(new Error("locked by Windows"), { code: "EPERM" });
        }
        await rename(from, to);
      },
    });

    assert.equal(renameCalls, 2);
    assert.deepEqual(tempNames, [".status.1.tmp", ".status.2.tmp"]);
    assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), { ok: true });
    assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith(".tmp")), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("agent status write failure is diagnostic and does not throw", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workmap-agent-status-test-"));
  const status: AgentStatus = {
    state: "connected",
    deviceId: "11111111-1111-4111-8111-111111111111",
    queuedEvents: 0,
  };

  try {
    const written = await writeAgentStatus(status, join(directory, "status.json"), {
      attempts: 1,
      retryDelayMs: 0,
      renameImpl: async () => {
        throw Object.assign(new Error("locked by Windows"), { code: "EPERM" });
      },
    });

    assert.equal(written, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
