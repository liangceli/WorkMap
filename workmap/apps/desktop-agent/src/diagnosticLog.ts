import {
  appendFile,
  mkdir,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { getAgentDataDirectory } from "./fileStore.js";

const MAX_LOG_BYTES = 5 * 1024 * 1024;
const RETENTION_DAYS = 7;

export type AgentDiagnosticEvent = {
  operation:
    | "lifecycle"
    | "native-host"
    | "policy"
    | "sync-v2"
    | "queue"
    | "retry"
    | "dead-letter";
  outcome: string;
  requestId?: string | null;
  intervalCount?: number;
  snapshotState?: string | null;
  queuePending?: number;
  queueDeadLetter?: number;
  httpStatus?: number | null;
  reasonCode?: string | null;
  reasonMessage?: string | null;
  remediation?: string | null;
  retryable?: boolean | null;
  retryAt?: string | null;
  durationMs?: number;
  policyVersion?: string | null;
  policyLeaseExpiresAt?: string | null;
};

export type AgentDiagnosticsBundle = {
  generatedAt: string;
  agentVersion: string;
  deviceId: string;
  logDirectory: string;
  connectionState: string;
  collectorState: string;
  queue: {
    pending: number;
    ready: number;
    deadLetter: number;
    deadLetterByCode: Array<{ code: string; count: number }>;
  };
  policy: {
    version: string | null;
    leasePresent: boolean;
    leaseExpiresAt: string | null;
    acknowledgementState: string | null;
  };
  lastSuccessfulSyncAt: string | null;
  lastSuccessfulHeartbeatAt: string | null;
  lastSyncDiagnostic: unknown;
  recentSyncFailures: unknown[];
};

export class AgentDiagnosticLog {
  private writeChain = Promise.resolve();

  constructor(
    private readonly directory = join(getAgentDataDirectory(), "logs"),
    private readonly now = () => new Date(),
  ) {}

  write(event: AgentDiagnosticEvent) {
    if (process.env.NODE_ENV === "test") return Promise.resolve();
    this.writeChain = this.writeChain
      .then(() => this.writeEntry(event))
      .catch(() => undefined);
    return this.writeChain;
  }

  async exportBundle(filePath: string, bundle: AgentDiagnosticsBundle) {
    await mkdir(this.directory, { recursive: true });
    await writeFile(filePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  }

  getDirectory() {
    return this.directory;
  }

  private async writeEntry(event: AgentDiagnosticEvent) {
    await mkdir(this.directory, { recursive: true });
    const timestamp = this.now();
    const filePath = join(
      this.directory,
      `agent-${timestamp.toISOString().slice(0, 10)}.ndjson`,
    );
    await this.rotateIfNeeded(filePath);
    await appendFile(
      filePath,
      `${JSON.stringify({ timestamp: timestamp.toISOString(), ...event })}\n`,
      "utf8",
    );
    await this.removeExpiredLogs(timestamp);
  }

  private async rotateIfNeeded(filePath: string) {
    try {
      const file = await stat(filePath);
      if (file.size < MAX_LOG_BYTES) return;
      const rotated = `${filePath}.1`;
      await rm(rotated, { force: true });
      await rename(filePath, rotated);
    } catch {
      // A missing or concurrently rotated log file needs no recovery action.
    }
  }

  private async removeExpiredLogs(now: Date) {
    const oldestAllowed = now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const entries = await readdir(this.directory, { withFileTypes: true });
    await Promise.all(
      entries.flatMap((entry) => {
        const match = /^agent-(\d{4}-\d{2}-\d{2})\.ndjson(?:\.1)?$/.exec(
          entry.name,
        );
        if (!entry.isFile() || !match?.[1]) return [];
        const fileDay = Date.parse(`${match[1]}T00:00:00.000Z`);
        return fileDay < oldestAllowed
          ? [rm(join(this.directory, entry.name), { force: true })]
          : [];
      }),
    );
  }
}
