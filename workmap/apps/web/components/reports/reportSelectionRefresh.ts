export type ReportSelectionRefreshOptions<TLive, TSummary> = {
  requestLive: () => Promise<TLive>;
  requestSummary: () => Promise<TSummary>;
  applyLive: (result: TLive) => void;
  applySummary: (result: TSummary) => void;
};

/**
 * A silent poll must not replace an established Tracking v2 view with the
 * legacy aggregate when the v2 request transiently fails or returns no rows.
 */
export function shouldApplySilentLiveRefresh(
  hasCurrentTrackingV2: boolean,
  hasNextTrackingV2: boolean,
) {
  return !hasCurrentTrackingV2 || hasNextTrackingV2;
}

/** Starts Live and Summary together, while allowing each section to settle independently. */
export async function refreshReportSelection<TLive, TSummary>({
  requestLive,
  requestSummary,
  applyLive,
  applySummary,
}: ReportSelectionRefreshOptions<TLive, TSummary>) {
  const liveTask = requestLive().then(applyLive);
  const summaryTask = requestSummary().then(applySummary);
  await Promise.all([liveTask, summaryTask]);
}
