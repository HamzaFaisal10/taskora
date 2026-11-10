import { Avatar as AvatarPrimitive } from "radix-ui";
import { avatarColor, cn, initials } from "@/lib/utils";

type AvatarProps = {
  name: string | null | undefined;
  src?: string | null;
  seed?: string;
  size?: number;
  className?: string;
};

export function Avatar({ name, src, seed, size = 28, className }: AvatarProps) {
  const label = name ?? "Unknown user";
  return (
    <AvatarPrimitive.Root
      className={cn("inline-flex shrink-0 overflow-hidden rounded-full select-none", className)}
      style={{ width: size, height: size }}
      title={label}
    >
      {src && <AvatarPrimitive.Image src={src} alt={label} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        className="flex size-full items-center justify-center font-semibold text-[#ECEDEE]"
        style={{
          background: avatarColor(seed ?? label),
          fontSize: Math.max(9, Math.round(size * 0.38)),
        }}
        aria-label={label}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function AvatarStack({
  people,
  max = 3,
  size = 28,
  ringClassName = "ring-bg",
}: {
  people: { id: string; name: string | null; avatarUrl?: string | null }[];
  max?: number;
  size?: number;
  /** Match the surface the stack sits on so each avatar gets a clean cut-out. */
  ringClassName?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <Avatar
          key={p.id}
          name={p.name}
          src={p.avatarUrl}
          seed={p.id}
          size={size}
          className={cn("ring-2", ringClassName, i > 0 && "-ml-0.5")}
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "bg-elevated text-muted -ml-0.5 flex items-center justify-center rounded-full text-[11px] ring-2",
            ringClassName,
          )}
          style={{ width: size, height: size }}
          aria-label={`${rest} more members`}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
