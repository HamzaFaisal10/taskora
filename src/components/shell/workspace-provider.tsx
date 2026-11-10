"use client";

import { createContext, useContext } from "react";
import type { ProjectSummary, Viewer, WorkspaceSummary } from "@/lib/workspace";

export type WorkspaceContextValue = {
  viewer: Viewer;
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  projects: ProjectSummary[];
  unreadCount: number;
};

const Ctx = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useWorkspace must be used inside /w/[slug]");
  return value;
}
