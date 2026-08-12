type TimerHandle = ReturnType<typeof setTimeout>;

type PollerScheduler = {
  setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
};

export type CompletionPoller = {
  trigger: () => void;
  stop: () => void;
};

/** Runs one task at a time and starts the next delay only after it settles. */
export function startCompletionPoller(
  task: () => Promise<void>,
  intervalMs: number,
  scheduler: PollerScheduler = { setTimeout, clearTimeout },
  startImmediately = true,
): CompletionPoller {
  let stopped = false;
  let running = false;
  let timer: TimerHandle | null = null;

  const schedule = () => {
    if (stopped) return;
    timer = scheduler.setTimeout(() => {
      timer = null;
      void run();
    }, intervalMs);
  };
  const run = async () => {
    if (stopped || running) return;
    running = true;
    try {
      await task();
    } catch {
      // Poll tasks own their UI error state. A failure must not stop later polls.
    } finally {
      running = false;
      schedule();
    }
  };
  const trigger = () => {
    if (stopped || running) return;
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
    void run();
  };

  if (startImmediately) trigger();
  else schedule();
  return {
    trigger,
    stop: () => {
      stopped = true;
      if (timer !== null) scheduler.clearTimeout(timer);
      timer = null;
    },
  };
}
