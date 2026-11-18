export class BrowserCallbackTimeoutError extends Error {}

/** Bound only the callback wait, not the stateful operation that consumes it. */
export function browserCallback<T>(
  invoke: (resolve: (value: T) => void, reject: (error: Error) => void) => void,
  timeoutMessage: string,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new BrowserCallbackTimeoutError(timeoutMessage));
    }, timeoutMs);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      callback();
    };
    try {
      invoke(
        (value) => finish(() => resolve(value)),
        (error) => finish(() => reject(error)),
      );
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new Error("Browser query failed.")));
    }
  });
}
