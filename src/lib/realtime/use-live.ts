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
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    // Realtime checks row level security with the token it holds, so hand it the signed-in token before
    // subscribing; otherwise the channel joins as anonymous and every row is filtered out.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      const ch = supabase.channel(`live:${key}`);
      for (const w of list) {
        ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table: w.table, filter: w.filter },
          fire,
        );
      }
      channel = ch.subscribe();
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key, signature, delay]);
}
