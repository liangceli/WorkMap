import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  describeTrackingV2Error,
  TrackingV2ReconciliationService,
} from "./tracking-v2-reconciliation.service.js";

const INITIAL_RECONCILIATION_DELAY_MS = 60_000;
const RECONCILIATION_INTERVAL_MS = 30_000;
const RECONCILIATION_BATCH_SIZE = 1;

@Injectable()
export class TrackingV2ReconciliationWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    TrackingV2ReconciliationWorker.name,
  );
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly reconciliation: TrackingV2ReconciliationService,
  ) {}

  onModuleInit() {
    this.schedule(INITIAL_RECONCILIATION_DELAY_MS);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delayMs: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.run();
    }, delayMs);
    this.timer.unref();
  }

  async runOnce() {
    const result = await this.reconciliation.reconcileDirtyTargets(
      RECONCILIATION_BATCH_SIZE,
    );
    return { deferred: false, reconciled: result.reconciled };
  }

  private async run() {
    try {
      await this.runOnce();
    } catch (error) {
      this.logger.warn(
        `Tracking v2 reconciliation retry failed; database targets remain retryable. ${describeTrackingV2Error(error)}`,
      );
    } finally {
      this.schedule(RECONCILIATION_INTERVAL_MS);
    }
  }
}
