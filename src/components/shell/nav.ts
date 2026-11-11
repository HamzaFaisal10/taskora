import { BarChart3, Bell, CircleUserRound, Goal, Home, Settings, Users } from "lucide-react";

export const workspaceNav = (slug: string) => [
  { href: `/w/${slug}`, label: "Home", icon: Home, exact: true },
  { href: `/w/${slug}/inbox`, label: "Inbox", icon: Bell, badge: "inbox" as const },
  { href: `/w/${slug}/my-tasks`, label: "My tasks", icon: CircleUserRound },
  { href: `/w/${slug}/goals`, label: "Goals", icon: Goal },
  { href: `/w/${slug}/analytics`, label: "Analytics", icon: BarChart3 },
];

export const settingsNav = (slug: string) => [
  { href: `/w/${slug}/settings/members`, label: "Members", icon: Users },
  { href: `/w/${slug}/settings/members`, label: "Settings", icon: Settings },
];
