"use client";

import { CalendarDays, ChartColumn, Columns3, GanttChart, List } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Real screens of the app (the demo workspace), in device frames. Each screen exists in a dark and a
 * light version, and the one matching the site's theme is shown.
 */

type ShotName = "board" | "list" | "timeline" | "calendar" | "analytics" | "home" | "task";

function Shot({
  name,
  device,
  alt,
  priority = false,
  sizes,
}: {
  name: ShotName;
  device: "desktop" | "phone";
  alt: string;
  priority?: boolean;
  sizes: string;
}) {
  const [w, h] = device === "desktop" ? [1920, 1200] : [780, 1594];
  const common = { width: w, height: h, sizes, priority, className: "block h-auto w-full" };
  return (
    <>
      <Image
        {...common}
        src={`/marketing/${name}-${device}-dark.webp`}
        alt={alt}
        className={cn(common.className, "hidden dark:block")}
      />
      <Image
        {...common}
        src={`/marketing/${name}-${device}-light.webp`}
        alt={alt}
        className={cn(common.className, "dark:hidden")}
      />
    </>
  );
}

/** An app window: a title bar with the page's address, then the screen. */
export function BrowserFrame({
  path,
  children,
  className,
}: {
  path: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card shadow-pop overflow-hidden rounded-[14px] border",
        className,
      )}
    >
      <div className="border-border bg-surface flex h-9 items-center gap-3 border-b px-3.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="bg-subtle/40 size-2.5 rounded-full" />
          <span className="bg-subtle/40 size-2.5 rounded-full" />
          <span className="bg-subtle/40 size-2.5 rounded-full" />
        </span>
        <span className="bg-bg text-subtle mx-auto max-w-[60%] truncate rounded-md px-3 py-0.5 font-mono text-[11px]">
          taskora.app{path}
        </span>
        <span className="w-[42px]" aria-hidden />
      </div>
      {children}
    </div>
  );
}

/** A laptop: the screen in a thin bezel, sitting on a base. */
function Laptop({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="relative rounded-t-[18px] border border-b-0 border-[#2a2d33] bg-[#16181c] p-[1.6%] pb-[2.2%]">
        <span
          className="absolute top-[0.55%] left-1/2 size-[clamp(3px,0.45vw,6px)] -translate-x-1/2 rounded-full bg-[#2b2f36]"
          aria-hidden
        />
        <div className="overflow-hidden rounded-[6px]">{children}</div>
      </div>
      <div className="relative mx-[-6%] h-[clamp(10px,1.6vw,18px)] rounded-b-[14px] bg-gradient-to-b from-[#3a3e45] to-[#24272c]">
        <span
          className="absolute top-0 left-1/2 h-[40%] w-[14%] -translate-x-1/2 rounded-b-md bg-[#1a1c20]"
          aria-hidden
        />
      </div>
    </div>
  );
}

/**
 * An iPhone: titanium rim, black bezel, the Dynamic Island in the status bar, side buttons and the home
 * indicator. Sizes are in container-width units, so it looks the same at any size.
 */
function Phone({ children, className }: { children: React.ReactNode; className?: string }) {
  const side = "absolute w-[1.1cqw] bg-gradient-to-r from-[#55585e] to-[#2c2e33]";
  return (
    <div className={cn("@container relative", className)}>
      {/* Action button and volume on the left, power on the right. */}
      <span
        className={cn(side, "top-[17%] -left-[0.8cqw] h-[6%] rounded-l-[0.6cqw]")}
        aria-hidden
      />
      <span
        className={cn(side, "top-[26%] -left-[0.8cqw] h-[10%] rounded-l-[0.6cqw]")}
        aria-hidden
      />
      <span
        className={cn(side, "top-[38%] -left-[0.8cqw] h-[10%] rounded-l-[0.6cqw]")}
        aria-hidden
      />
      <span
        className={cn(
          side,
          "top-[29%] -right-[0.8cqw] h-[15%] rounded-r-[0.6cqw] bg-gradient-to-l",
        )}
        aria-hidden
      />
      <div className="rounded-[17cqw] bg-gradient-to-br from-[#6b6e74] via-[#2e3034] to-[#55585d] p-[1.1cqw] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.75)]">
        <div className="rounded-[16cqw] bg-black p-[3.6cqw]">
          <div className="bg-bg relative overflow-hidden rounded-[12.6cqw]">
            <div
              className="text-fg relative flex h-[12.5cqw] items-center justify-between px-[8.5cqw] pt-[1.2cqw] text-[3.9cqw] font-semibold tracking-tight"
              aria-hidden
            >
              <span className="w-[16cqw]">9:41</span>
              <span className="absolute top-[2.6cqw] left-1/2 h-[8.4cqw] w-[30cqw] -translate-x-1/2 rounded-full bg-black" />
              <span className="flex w-[16cqw] items-center justify-end gap-[1.2cqw]">
                <svg viewBox="0 0 18 12" className="h-[3cqw] w-auto fill-current">
                  <rect x="0" y="8" width="3" height="4" rx="0.8" />
                  <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
                  <rect x="10" y="3" width="3" height="9" rx="0.8" />
                  <rect x="15" y="0" width="3" height="12" rx="0.8" />
                </svg>
                <svg viewBox="0 0 16 12" className="h-[3cqw] w-auto fill-current">
                  <path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.3-1.4A10.4 10.4 0 0 0 8 .7 10.4 10.4 0 0 0 .7 3.6L2 5a8.5 8.5 0 0 1 6-2.4Zm0 3.7c1.3 0 2.5.5 3.4 1.3l1.3-1.4A6.8 6.8 0 0 0 8 4.4a6.8 6.8 0 0 0-4.7 1.8l1.3 1.4c.9-.8 2.1-1.3 3.4-1.3Zm0 3.6c.4 0 .8.2 1.1.4L8 11.6 6.9 10.3c.3-.2.7-.4 1.1-.4Z" />
                </svg>
                <svg viewBox="0 0 27 13" className="h-[3.1cqw] w-auto">
                  <rect
                    x="0.5"
                    y="0.5"
                    width="23"
                    height="12"
                    rx="3.5"
                    className="fill-none stroke-current opacity-40"
                  />
                  <rect x="2.5" y="2.5" width="19" height="8" rx="2" className="fill-current" />
                  <path
                    d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z"
                    className="fill-current opacity-40"
                  />
                </svg>
              </span>
            </div>
            {children}
            <span
              className="bg-fg/85 absolute bottom-[1.8cqw] left-1/2 h-[1.25cqw] w-[34cqw] -translate-x-1/2 rounded-full"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const TOUR = [
  {
    id: "board",
    icon: Columns3,
    name: "Board",
    path: "/w/halcyon/p/MOB",
    text: "Drag work across your own columns. Cards show labels, due dates, subtasks and who has them.",
  },
  {
    id: "list",
    icon: List,
    name: "List",
    path: "/w/halcyon/p/MOB/list",
    text: "Every task in one dense list. Sort, select several and change them together, or import a CSV.",
  },
  {
    id: "timeline",
    icon: GanttChart,
    name: "Timeline",
    path: "/w/halcyon/p/MOB/timeline",
    text: "Start and due dates as bars, with the sprint and today marked, so overlaps are easy to spot.",
  },
  {
    id: "calendar",
    icon: CalendarDays,
    name: "Calendar",
    path: "/w/halcyon/p/MOB/calendar",
    text: "A month or a week of due dates. Drag a task to another day to reschedule it.",
  },
  {
    id: "analytics",
    icon: ChartColumn,
    name: "Analytics",
    path: "/w/halcyon/analytics",
    text: "Throughput, cycle time and overdue work for the last 30 days, compared with the 30 before.",
  },
] as const;

/** Tabs that switch between real screens of one project, in an app window. */
export function ProductTour() {
  const [active, setActive] = useState<(typeof TOUR)[number]["id"]>("board");
  const current = TOUR.find((t) => t.id === active)!;
  return (
    <div>
      <div
        role="tablist"
        aria-label="Views"
        className="flex [scrollbar-width:none] gap-1 overflow-x-auto pb-1"
      >
        {TOUR.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tour-tab-${t.id}`}
            aria-selected={t.id === active}
            aria-controls="tour-panel"
            onClick={() => setActive(t.id)}
            className={cn(
              "rounded-control flex shrink-0 items-center gap-2 px-3.5 py-2 text-sm transition-colors",
              t.id === active
                ? "bg-elevated text-fg font-medium"
                : "text-muted hover:text-fg hover:bg-surface",
            )}
          >
            <t.icon className={cn("size-4", t.id === active && "text-accent-text")} aria-hidden />
            {t.name}
          </button>
        ))}
      </div>
      <p className="text-muted mt-3 min-h-12 max-w-2xl leading-relaxed" aria-live="polite">
        {current.text}
      </p>
      <p className="text-subtle mt-1 text-xs sm:hidden">Swipe the screen to see all of it.</p>
      <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${active}`} className="mt-5">
        <BrowserFrame path={current.path}>
          {TOUR.map((t) => (
            // On a phone the screen keeps a readable size and scrolls sideways.
            <div
              key={t.id}
              hidden={t.id !== active}
              className="[scrollbar-width:thin] overflow-x-auto"
            >
              <div className="min-w-[720px] sm:min-w-0">
                <Shot
                  name={t.id}
                  device="desktop"
                  alt={`The ${t.name} view of the Mobile App project in the demo workspace`}
                  sizes="(min-width: 1152px) 1104px, (min-width: 640px) 100vw, 720px"
                />
              </div>
            </div>
          ))}
        </BrowserFrame>
      </div>
    </div>
  );
}

/** The same workspace on a laptop and on a phone. */
export function Everywhere() {
  return (
    <div className="relative mx-auto max-w-5xl pr-[22%] pb-[6%] sm:pr-[18%] sm:pb-[4%]">
      <Laptop>
        <Shot
          name="board"
          device="desktop"
          alt="The board of the Mobile App project on a laptop"
          sizes="(min-width: 1024px) 820px, 80vw"
        />
      </Laptop>
      <div className="absolute right-0 bottom-0 w-[34%] sm:w-[22%]">
        <Phone>
          <Shot
            name="home"
            device="phone"
            alt="Home on a phone: tasks assigned to you, overdue work and unread updates"
            sizes="(min-width: 1024px) 220px, 34vw"
          />
        </Phone>
      </div>
    </div>
  );
}
