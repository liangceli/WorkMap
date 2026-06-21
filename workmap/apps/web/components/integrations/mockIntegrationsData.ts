export type IntegrationStatus = "ready" | "link_launcher" | "needs_setup";

export type IntegrationItem = {
  id: string;
  name: string;
  category: "Communication" | "Calendar" | "Calling";
  description: string;
  actionLabel: string;
  href: string;
  status: IntegrationStatus;
  privacyNote: string;
};

export const integrationItems: IntegrationItem[] = [
  {
    id: "teams",
    name: "Microsoft Teams",
    category: "Communication",
    description: "Open a teammate chat from WorkMap contact actions.",
    actionLabel: "Open Teams link",
    href: "https://teams.microsoft.com/l/chat/0/0",
    status: "link_launcher",
    privacyNote: "Link-based only. No Microsoft Graph permissions are requested in this MVP.",
  },
  {
    id: "outlook",
    name: "Outlook Email",
    category: "Communication",
    description: "Launch a pre-addressed email compose flow from employee profiles.",
    actionLabel: "Open mail link",
    href: "mailto:?subject=WorkMap%20follow-up",
    status: "ready",
    privacyNote: "Uses mailto links. WorkMap does not read email bodies.",
  },
  {
    id: "calendar",
    name: "Outlook Calendar",
    category: "Calendar",
    description: "Prepare meeting scheduling entry points for teammate contact cards.",
    actionLabel: "Open calendar",
    href: "https://outlook.office.com/calendar/",
    status: "link_launcher",
    privacyNote: "No calendar read/write API access is enabled yet.",
  },
  {
    id: "3cx",
    name: "3CX",
    category: "Calling",
    description: "Open a call action from WorkMap contact menus.",
    actionLabel: "Open 3CX",
    href: "https://www.3cx.com/user-manual/web-client/",
    status: "needs_setup",
    privacyNote: "Link-based launch only. WorkMap does not record call audio.",
  },
];
