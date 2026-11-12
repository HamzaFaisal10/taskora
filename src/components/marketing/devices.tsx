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
  const [w, h] = device === "desktop" ? [1920, 1200] : [720, 1226];
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
      <div className="rounded-t-[18px] border border-b-0 border-[#2a2d33] bg-[#16181c] p-[1.6%] pb-[2.2%]">
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

/** A phone: rounded body, thin bezel, a status bar and a camera pill at the top. */
function Phone({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[clamp(22px,4vw,44px)] border border-[#2a2d33] bg-[#16181c] p-[3.2%] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)]",
        className,
      )}
    >
      <div className="bg-bg overflow-hidden rounded-[clamp(16px,3.2vw,36px)]">
        <div
          className="text-fg relative flex aspect-[720/78] items-center justify-between px-[9%] text-[clamp(7px,1vw,12px)] font-semibold"
          aria-hidden
        >
          <span>9:41</span>
          <span className="absolute top-1/2 left-1/2 h-[46%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
          <span className="flex items-center gap-[0.3em]">
            <span className="flex h-[0.8em] items-end gap-[0.12em]">
              <span className="h-[40%] w-[0.18em] rounded-[1px] bg-current" />
              <span className="h-[60%] w-[0.18em] rounded-[1px] bg-current" />
              <span className="h-[80%] w-[0.18em] rounded-[1px] bg-current" />
              <span className="h-full w-[0.18em] rounded-[1px] bg-current" />
            </span>
            <span className="relative h-[0.85em] w-[1.7em] rounded-[0.25em] border border-current p-[0.1em]">
              <span className="block h-full w-[75%] rounded-[0.1em] bg-current" />
            </span>
          </span>
        </div>
        {children}
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
