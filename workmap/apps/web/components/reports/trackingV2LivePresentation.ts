import type { WorkMapApiTrackingV2LiveActivity } from "../../lib/api/apiTypes.js";

export type TrackingV2LiveDevice =
  WorkMapApiTrackingV2LiveActivity["devices"][number];

export function trackingV2ConnectionPresentation(
  device: TrackingV2LiveDevice,
) {
  if (!device.health || !device.connectionFresh) {
    return {
      connected: false,
      label: "Signal interrupted",
      pill: device.health ? "Stale" : "Health pending",
      detail: device.health
        ? "No recent server-confirmed health signal."
        : "Waiting for the first server-confirmed health signal.",
    };
  }

  // Reaching this response proves the device credential and health lane were
  // accepted by the server. Collector, policy, queue, and snapshot issues are
  // displayed independently and must not turn this into a disconnect warning.
  return {
    connected: true,
    label: "Connected",
    pill: device.health.migrationState,
    detail: "The latest device health signal was confirmed by WorkMap.",
  };
}

export function trackingV2SnapshotPresentation(
  device: TrackingV2LiveDevice,
) {
  if (device.snapshotStatus === "REJECTED") {
    if (device.health?.serverDiagnosticCode === "SNAPSHOT_OUTSIDE_POLICY_WINDOW") {
      return {
        available: false,
        label: "Current activity not confirmed",
        detail: device.connectionFresh
          ? "The connection is online, but the latest App snapshot was outside the approved collection window."
          : "The latest App snapshot was outside the approved collection window.",
        pill: "Outside collection window",
      };
    }
    if (device.health?.serverDiagnosticCode === "SNAPSHOT_POLICY_LEASE_INVALID") {
      return {
        available: false,
        label: "Current activity not confirmed",
        detail: device.connectionFresh
          ? "The connection is online, but the latest App snapshot needs a refreshed policy lease."
          : "The latest App snapshot needs a refreshed policy lease.",
        pill: "Policy refresh",
      };
    }
    return {
      available: false,
      label: "Current activity not confirmed",
      detail: device.connectionFresh
        ? "The connection is online, but the latest App snapshot time could not be verified."
        : "The latest App snapshot time could not be verified.",
      pill: "Snapshot warning",
    };
  }

  if (device.snapshotStatus === "CURRENT" && device.current) {
    return {
      available: true,
      label: device.current.displayName ?? "Current focus confirmed",
      detail:
        device.current.state === "ACTIVE"
          ? "Current focus-active snapshot confirmed"
          : "Current focused-idle snapshot confirmed",
      pill: "Current",
    };
  }

  if (device.snapshotStatus === "NO_CURRENT_FOCUS") {
    return {
      available: false,
      label: "No current focus",
      detail: device.connectionFresh
        ? "The connection is online and the latest snapshot contains no current App."
        : "The latest snapshot contains no current App, and the connection is not currently confirmed.",
      pill: "No current App",
    };
  }

  if (device.snapshotStatus === "STALE") {
    return {
      available: false,
      label: "Current activity not confirmed",
      detail: device.connectionFresh
        ? "The connection is online, but the last App snapshot is stale."
        : "The last App snapshot is stale and the connection signal is interrupted.",
      pill: "Snapshot stale",
    };
  }

  return {
    available: false,
    label: "No current App snapshot",
    detail: device.connectionFresh
      ? "The connection is online; WorkMap has not confirmed a current App snapshot."
      : "WorkMap has not received a current App snapshot.",
    pill: "Not received",
  };
}
