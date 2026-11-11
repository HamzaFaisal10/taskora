"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Watch = { table: "tasks" | "comments" | "notifications" | "task_statuses"; filter: string };

/**
 * Calls `onChange` (debounced) whenever a watched table changes. Supabase Realtime only delivers rows
 * that row level security lets this person read.
 */
export function useLive(key: string, watches: Watch[], onChange: () => void, delay = 400) {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });

  const signature = JSON.stringify(watches);
  useEffect(() => {
    const list: Watch[] = JSON.parse(signature);
    if (!list.length) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(), delay);
    };
    let channel = supabase.channel(`live:${key}`);
    for (const w of list) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: w.table, filter: w.filter },
        fire,
      );
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key, signature, delay]);
}
