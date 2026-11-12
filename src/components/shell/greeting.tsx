"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const hour = () => new Date().getHours();

/** Greets by the viewer's own clock. The server doesn't know their time zone, so it says "Welcome". */
export function Greeting({ name }: { name: string }) {
  const h = useSyncExternalStore(subscribe, hour, () => null);
  const hello =
    h === null
      ? "Welcome"
      : h < 5
        ? "Good evening"
        : h < 12
          ? "Good morning"
          : h < 18
            ? "Good afternoon"
            : "Good evening";
  return (
    <>
      {hello}, {name}
    </>
  );
}
