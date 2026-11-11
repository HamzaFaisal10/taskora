import { BarChart3, Bell, CircleUserRound, Clock, Goal, Home, Settings, Users } from "lucide-react";

export const workspaceNav = (slug: string) => [
  { href: `/w/${slug}`, label: "Home", icon: Home, exact: true },
  { href: `/w/${slug}/inbox`, label: "Inbox", icon: Bell, badge: "inbox" as const },
  { href: `/w/${slug}/my-tasks`, label: "My tasks", icon: CircleUserRound },
  { href: `/w/${slug}/goals`, label: "Goals", icon: Goal },
  { href: `/w/${slug}/analytics`, label: "Analytics", icon: BarChart3 },
  { href: `/w/${slug}/time`, label: "Time", icon: Clock },
];

export const settingsNav = (slug: string) => [
  { href: `/w/${slug}/settings`, label: "Settings", icon: Settings },
  { href: `/w/${slug}/settings/members`, label: "Members", icon: Users },
];
