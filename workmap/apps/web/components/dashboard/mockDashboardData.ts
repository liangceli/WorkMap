import type { UserPresenceStatus } from "@workmap/shared-types";
import { avatarLayersByType, type LayeredAvatarConfig } from "../../lib/avatar/avatarLayerAssets";

export type DashboardEmployee = {
  id: string;
  name: string;
  role: string;
  department: string;
  status: UserPresenceStatus;
  localTime: string;
  avatar: LayeredAvatarConfig;
  activeTime: string;
  idleTime: string;
  topApp: string;
  topDomain: string;
  deviceHealth?: "online" | "delayed" | "offline";
};

export type UsageMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "blue" | "amber" | "slate";
};

export type UsageRow = {
  name: string;
  category: string;
  duration: string;
  share: string;
};

export const usageMetrics: UsageMetric[] = [
  { label: "Team active time", value: "32h 40m", detail: "Across 8 active employees today", tone: "green" },
  { label: "Focus room usage", value: "6h 15m", detail: "Mostly engineering and finance", tone: "blue" },
  { label: "Idle time", value: "3h 05m", detail: "Within normal daily range", tone: "amber" },
  { label: "Devices online", value: "11 / 12", detail: "One device has not checked in", tone: "slate" },
];

export const appUsageRows: UsageRow[] = [
  { name: "Visual Studio Code", category: "Development", duration: "8h 25m", share: "26%" },
  { name: "Microsoft Teams", category: "Communication", duration: "5h 10m", share: "16%" },
  { name: "Figma", category: "Design", duration: "3h 35m", share: "11%" },
  { name: "Excel", category: "Operations", duration: "2h 45m", share: "8%" },
];

export const websiteUsageRows: UsageRow[] = [
  { name: "github.com", category: "Development", duration: "4h 55m", share: "18%" },
  { name: "office.com", category: "Productivity", duration: "3h 20m", share: "12%" },
  { name: "figma.com", category: "Design", duration: "2h 50m", share: "10%" },
  { name: "atlassian.com", category: "Planning", duration: "2h 10m", share: "8%" },
];

export const dashboardEmployees: DashboardEmployee[] = [
  {
    id: "mia",
    name: "Mia Manager",
    role: "Engineering Manager",
    department: "Engineering",
    status: "busy",
    localTime: "10:32 AM",
    avatar: createAvatar(2, 1, 18, 10, 0),
    activeTime: "5h 20m",
    idleTime: "22m",
    topApp: "Teams",
    topDomain: "office.com",
    deviceHealth: "online",
  },
  {
    id: "ethan",
    name: "Ethan Engineer",
    role: "Software Engineer",
    department: "Engineering",
    status: "focus",
    localTime: "10:32 AM",
    avatar: createAvatar(5, 3, 31, 7, 4),
    activeTime: "6h 05m",
    idleTime: "18m",
    topApp: "VS Code",
    topDomain: "github.com",
    deviceHealth: "online",
  },
  {
    id: "sofia",
    name: "Sofia Sales",
    role: "Account Executive",
    department: "Sales",
    status: "available",
    localTime: "10:32 AM",
    avatar: createAvatar(7, 4, 40, 3, 6),
    activeTime: "4h 45m",
    idleTime: "31m",
    topApp: "Outlook",
    topDomain: "office.com",
    deviceHealth: "online",
  },
];

export const employeeDirectoryRows: DashboardEmployee[] = [
  ...dashboardEmployees,
  {
    id: "nora",
    name: "Nora Finance",
    role: "Finance Analyst",
    department: "Finance",
    status: "idle",
    localTime: "10:32 AM",
    avatar: createAvatar(1, 2, 8, 11, 2),
    activeTime: "3h 55m",
    idleTime: "48m",
    topApp: "Excel",
    topDomain: "office.com",
    deviceHealth: "delayed",
  },
  {
    id: "leo",
    name: "Leo Support",
    role: "Customer Support Lead",
    department: "Support",
    status: "on_call",
    localTime: "10:32 AM",
    avatar: createAvatar(4, 0, 23, 8),
    activeTime: "5h 10m",
    idleTime: "14m",
    topApp: "3CX",
    topDomain: "zendesk.com",
    deviceHealth: "online",
  },
  {
    id: "ava",
    name: "Ava Designer",
    role: "Product Designer",
    department: "Design",
    status: "focus",
    localTime: "10:32 AM",
    avatar: createAvatar(8, 3, 12, 2, 7),
    activeTime: "4h 30m",
    idleTime: "20m",
    topApp: "Figma",
    topDomain: "figma.com",
    deviceHealth: "online",
  },
  {
    id: "sam",
    name: "Sam Ops",
    role: "Operations Coordinator",
    department: "Operations",
    status: "break",
    localTime: "10:32 AM",
    avatar: createAvatar(3, 1, 35, 5, 1),
    activeTime: "3h 25m",
    idleTime: "36m",
    topApp: "Teams",
    topDomain: "atlassian.com",
    deviceHealth: "online",
  },
  {
    id: "iris",
    name: "Iris QA",
    role: "QA Engineer",
    department: "Engineering",
    status: "offline",
    localTime: "10:32 AM",
    avatar: createAvatar(6, 4, 44, 0),
    activeTime: "2h 40m",
    idleTime: "1h 05m",
    topApp: "Playwright",
    topDomain: "github.com",
    deviceHealth: "offline",
  },
];

export function createAvatar(body: number, eyes: number, hairstyle: number, outfit: number, accessory?: number): LayeredAvatarConfig {
  return {
    version: 2,
    bodyId: avatarLayersByType.body[body % avatarLayersByType.body.length]?.id ?? "",
    eyesId: avatarLayersByType.eyes[eyes % avatarLayersByType.eyes.length]?.id,
    hairstyleId: avatarLayersByType.hairstyle[hairstyle % avatarLayersByType.hairstyle.length]?.id,
    outfitId: avatarLayersByType.outfit[outfit % avatarLayersByType.outfit.length]?.id,
    accessoryIds:
      accessory === undefined || avatarLayersByType.accessory.length === 0
        ? []
        : [avatarLayersByType.accessory[accessory % avatarLayersByType.accessory.length].id],
  };
}
