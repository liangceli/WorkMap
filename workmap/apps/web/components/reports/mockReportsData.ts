export type ReportMetric = {
  label: string;
  value: string;
  detail: string;
};

export type ReportRow = {
  department: string;
  activeTime: string;
  idleTime: string;
  topApp: string;
  topDomain: string;
  health: "normal" | "watch" | "quiet";
};

export const reportMetrics: ReportMetric[] = [
  { label: "Active time", value: "32h 40m", detail: "Across current mock team" },
  { label: "Idle time", value: "3h 05m", detail: "Within normal range" },
  { label: "Online devices", value: "11 / 12", detail: "One delayed or offline" },
  { label: "Focus usage", value: "6h 15m", detail: "Focus room and focus statuses" },
];

export const reportRows: ReportRow[] = [
  {
    department: "Engineering",
    activeTime: "14h 05m",
    idleTime: "1h 25m",
    topApp: "VS Code",
    topDomain: "github.com",
    health: "normal",
  },
  {
    department: "Sales",
    activeTime: "4h 45m",
    idleTime: "31m",
    topApp: "Outlook",
    topDomain: "office.com",
    health: "normal",
  },
  {
    department: "Finance",
    activeTime: "3h 55m",
    idleTime: "48m",
    topApp: "Excel",
    topDomain: "office.com",
    health: "watch",
  },
  {
    department: "Design",
    activeTime: "4h 30m",
    idleTime: "20m",
    topApp: "Figma",
    topDomain: "figma.com",
    health: "normal",
  },
  {
    department: "Support",
    activeTime: "5h 10m",
    idleTime: "14m",
    topApp: "3CX",
    topDomain: "zendesk.com",
    health: "quiet",
  },
];
