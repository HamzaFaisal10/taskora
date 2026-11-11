"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Disables itself while the invite is being accepted, so a second click can't be sent. */
export function AcceptButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {pending ? "Joining…" : "Accept invitation"}
    </Button>
  );
}
