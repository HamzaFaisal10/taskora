"use client";

import { useEffect, useState } from "react";

/** Seconds since `startedAt`, ticking every second while mounted. */
export function useElapsed(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? (now - new Date(startedAt).getTime()) / 1000 : 0;
}
