import { cn } from "@/lib/utils";

type LogoMarkProps = {
  size?: number;
  className?: string;
  /** "default" = lime tile, "inverse" = dark tile, "mono" = mark only in currentColor */
  variant?: "default" | "inverse" | "mono";
  title?: string;
};

/** The Taskora mark: a "T" built from two task cards, plus a done dot. */
export function LogoMark({
  size = 28,
  className,
  variant = "default",
  title = "Taskora",
}: LogoMarkProps) {
  const tile = variant === "default" ? "#CDF461" : variant === "inverse" ? "#15171A" : "none";
  const ink =
    variant === "default" ? "#0E0F11" : variant === "inverse" ? "#CDF461" : "currentColor";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      {tile !== "none" && <rect width="32" height="32" rx="9" fill={tile} />}
      <rect x="7" y="8" width="18" height="5.5" rx="2.75" fill={ink} />
      <rect x="13.25" y="15.5" width="5.5" height="9.5" rx="2.75" fill={ink} />
      <circle cx="22.5" cy="21.75" r="2.25" fill={ink} />
    </svg>
  );
}

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="text-fg text-[17px] font-semibold tracking-tight">Taskora</span>
    </span>
  );
}
