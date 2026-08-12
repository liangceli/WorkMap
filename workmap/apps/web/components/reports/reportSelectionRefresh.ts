export type ReportSelectionRefreshOptions<TLive, TSummary> = {
  requestLive: () => Promise<TLive>;
  requestSummary: () => Promise<TSummary>;
  applyLive: (result: TLive) => void;
  applySummary: (result: TSummary) => void;
};

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
