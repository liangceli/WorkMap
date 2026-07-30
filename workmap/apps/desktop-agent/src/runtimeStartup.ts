export type RuntimeStartupRetrierOptions<TConfig> = {
  loadConfig: () => Promise<TConfig | null>;
  start: (config: TConfig) => Promise<void> | void;
  isStarted: () => boolean;
  retryDelaysMs?: number[];
  onFailure?: (error: unknown) => void;
};

const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000, 60_000];

/**
 * Starts the long-lived Agent runtime without allowing one transient protected
 * config read to strand the Electron process until the user restarts Windows.
 * This coordinator does not sample activity or retry tracking uploads.
 */
export class RuntimeStartupRetrier<TConfig> {
  private attemptPromise: Promise<boolean> | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryIndex = 0;
  private readonly retryDelaysMs: number[];
  private lastFailure: unknown = null;

  constructor(private readonly options: RuntimeStartupRetrierOptions<TConfig>) {
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  }

  ensure(config?: TConfig): Promise<boolean> {
    if (this.options.isStarted()) {
      this.markStarted();
      return Promise.resolve(true);
    }
    if (this.attemptPromise) return this.attemptPromise;
    this.attemptPromise = this.attempt(config).finally(() => {
      this.attemptPromise = null;
    });
    return this.attemptPromise;
  }

  failure() {
    return this.lastFailure;
  }

  stop() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private async attempt(providedConfig?: TConfig) {
    try {
      const config = providedConfig ?? await this.options.loadConfig();
      if (!config) {
        this.lastFailure = new Error("The paired Agent configuration is temporarily unavailable.");
        this.scheduleRetry();
        return false;
      }
      await this.options.start(config);
      if (!this.options.isStarted()) {
        throw new Error("The Desktop Agent runtime did not start.");
      }
      this.markStarted();
      return true;
    } catch (error) {
      this.lastFailure = error;
      this.options.onFailure?.(error);
      this.scheduleRetry();
      return false;
    }
  }

  private scheduleRetry() {
    if (
      this.retryTimer ||
      this.options.isStarted() ||
      this.retryIndex >= this.retryDelaysMs.length
    ) {
      return;
    }
    const delayMs = this.retryDelaysMs[this.retryIndex++];
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.ensure();
    }, delayMs);
  }

  private markStarted() {
    this.lastFailure = null;
    this.retryIndex = 0;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}
