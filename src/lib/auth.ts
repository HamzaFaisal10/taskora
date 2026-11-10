/** Only allow redirects to paths on this site (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/app") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback;
  return next;
}
