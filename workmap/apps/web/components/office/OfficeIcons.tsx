"use client";

type OfficeIconProps = {
  name:
    | "calendar"
    | "chat"
    | "chevronDown"
    | "close"
    | "copy"
    | "go"
    | "mail"
    | "map"
    | "people"
    | "phone"
    | "room"
    | "search"
    | "settings"
    | "smile"
    | "status"
    | "target"
    | "wave";
  size?: number;
};

export function OfficeIcon({ name, size = 22 }: OfficeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const iconProps = {
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const paths = {
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" {...iconProps} />
      <path d="M8 3v4M16 3v4M4 10h16" {...iconProps} />
    </>
  ),
  chat: (
    <>
      <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v4A3.5 3.5 0 0 1 15.5 14H10l-5 4v-4.5A3.5 3.5 0 0 1 5 10.5v-4Z" {...iconProps} />
      <path d="M9 8h6M9 11h3" {...iconProps} />
    </>
  ),
  chevronDown: (
    <path d="M6 9l6 6 6-6" {...iconProps} />
  ),
  close: (
    <>
      <path d="M6 6l12 12" {...iconProps} />
      <path d="M18 6L6 18" {...iconProps} />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" {...iconProps} />
      <path d="M5 15V7a2 2 0 0 1 2-2h8" {...iconProps} />
    </>
  ),
  go: (
    <>
      <path d="M13 5l7 7-7 7" {...iconProps} />
      <path d="M20 12H6" {...iconProps} />
      <path d="M6 6H4v12h2" {...iconProps} />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" {...iconProps} />
      <path d="M4 7l8 6 8-6" {...iconProps} />
    </>
  ),
  map: (
    <>
      <path d="M8 5l8-2 5 2v14l-5-2-8 2-5-2V3l5 2Z" {...iconProps} />
      <path d="M8 5v14M16 3v14" {...iconProps} />
    </>
  ),
  people: (
    <>
      <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21a6 6 0 0 1 12 0" {...iconProps} />
      <path d="M17 10a3 3 0 1 0 0-6M17 14a5 5 0 0 1 4 4" {...iconProps} />
    </>
  ),
  phone: (
    <path d="M8 4l2 4-2 2c1.5 3 3 4.5 6 6l2-2 4 2-1.5 4C10 19 5 14 4 5.5L8 4Z" {...iconProps} />
  ),
  room: (
    <>
      <path d="M4 5h16v14H4z" {...iconProps} />
      <path d="M8 19V9h8v10M10 13h.01" {...iconProps} />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" {...iconProps} />
      <path d="M16 16l4 4" {...iconProps} />
    </>
  ),
  settings: (
    <>
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" {...iconProps} />
      <path d="M4 12h2M18 12h2M12 4v2M12 18v2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" {...iconProps} />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" {...iconProps} />
      <path d="M8.5 10h.01M15.5 10h.01M8.5 14.5c1.9 2 5.1 2 7 0" {...iconProps} />
    </>
  ),
  status: (
    <>
      <path d="M12 4v8l5 3" {...iconProps} />
      <circle cx="12" cy="12" r="9" {...iconProps} />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" {...iconProps} />
      <circle cx="12" cy="12" r="2.5" {...iconProps} />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...iconProps} />
    </>
  ),
  wave: (
    <path d="M7 11V5a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v7a7 7 0 0 1-14 0v-2a2 2 0 0 1 4 0v2" {...iconProps} />
  ),
};
