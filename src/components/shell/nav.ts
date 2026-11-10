import { Bell, CircleUserRound, Home, Settings, Users } from "lucide-react";

export const workspaceNav = (slug: string) => [
  { href: `/w/${slug}`, label: "Home", icon: Home, exact: true },
  { href: `/w/${slug}/inbox`, label: "Inbox", icon: Bell, badge: "inbox" as const },
  { href: `/w/${slug}/my-tasks`, label: "My tasks", icon: CircleUserRound },
];

export const settingsNav = (slug: string) => [
  { href: `/w/${slug}/settings/members`, label: "Members", icon: Users },
  { href: `/w/${slug}/settings/members`, label: "Settings", icon: Settings },
];
