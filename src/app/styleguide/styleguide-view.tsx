"use client";

import {
  CalendarDays,
  Filter,
  MessageSquare,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Logo, LogoMark } from "@/components/brand/logo";
import { PriorityIcon, StatusDot, type Priority } from "@/components/tasks/task-meta";
import { ThemeToggle } from "@/components/theme";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Select, Switch, Tabs, TabsList, TabsTrigger } from "@/components/ui/controls";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError, Input, Kbd, Label, Textarea } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Tooltip,
} from "@/components/ui/menu";
import { Card, EmptyState, Progress, Skeleton } from "@/components/ui/surface";

const team = [
  { id: "u1", name: "Hamza Faisal" },
  { id: "u2", name: "Sara Rehman" },
  { id: "u3", name: "Zain Malik" },
  { id: "u4", name: "Ayesha Khan" },
  { id: "u5", name: "Omar Siddiqui" },
];

const colorTokens = [
  "bg",
  "surface",
  "card",
  "elevated",
  "border",
  "fg",
  "muted",
  "accent",
  "danger",
  "warning",
  "info",
  "success",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-subtle text-xs font-medium tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function StyleguideView() {
  const [priority, setPriority] = React.useState<Priority>("high");
  const [done, setDone] = React.useState(true);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 sm:px-8">
      <header className="flex flex-wrap items-center gap-4">
        <Logo size={32} />
        <span className="text-muted">Design system</span>
        <span className="flex-1" />
        <ThemeToggle />
      </header>

      <Section title="Brand">
        <div className="flex flex-wrap items-center gap-4">
          <LogoMark size={56} />
          <span className="rounded-card flex size-14 items-center justify-center bg-[#F7F7F5]">
            <LogoMark size={36} variant="inverse" />
          </span>
          <span className="rounded-card border-border text-fg flex size-14 items-center justify-center border">
            <LogoMark size={36} variant="mono" />
          </span>
        </div>
      </Section>

      <Section title="Color tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {colorTokens.map((t) => (
            <div key={t} className="flex flex-col gap-1.5">
              <div
                className="rounded-control border-border h-12 border"
                style={{ background: `var(--${t})` }}
              />
              <span className="text-muted font-mono text-xs">--{t}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <Card className="flex flex-col gap-3 p-6">
          <p className="text-[44px] leading-[48px] font-semibold tracking-tight">
            Ship work, not status updates.
          </p>
          <p className="text-[22px] font-semibold tracking-tight">Heading · 22 / 600</p>
          <p className="text-fg-2">
            Body · 14 / 400. Compact text built for dense boards and long descriptions.
          </p>
          <p className="text-muted text-xs">Caption · 12 / 400 — dates, counts and meta</p>
          <p className="text-muted font-mono text-xs">MOB-136 · mono for task IDs and shortcuts</p>
        </Card>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Plus /> New task
          </Button>
          <Button variant="secondary">
            <Filter /> Filter
          </Button>
          <Button variant="ai">
            <Sparkles /> Generate with AI
          </Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">
            <Trash2 /> Delete
          </Button>
          <Button loading>Saving</Button>
          <Button variant="secondary" size="icon" aria-label="Add">
            <Plus />
          </Button>
          <Button variant="link">View all</Button>
        </div>
      </Section>

      <Section title="Badges, status and priority">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">Mobile</Badge>
          <Badge tone="violet">Backend</Badge>
          <Badge tone="pink">Design</Badge>
          <Badge tone="warning">Payments</Badge>
          <Badge tone="accent">AI</Badge>
          <Badge tone="danger">Bug</Badge>
          <Badge tone="solid" shape="tag">
            On track
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <span className="flex items-center gap-2">
            <StatusDot color="var(--subtle)" group="backlog" /> Backlog
          </span>
          <span className="flex items-center gap-2">
            <StatusDot color="var(--fg)" group="unstarted" /> To do
          </span>
          <span className="flex items-center gap-2">
            <StatusDot color="var(--warning)" group="started" /> In progress
          </span>
          <span className="flex items-center gap-2">
            <StatusDot color="var(--info)" group="review" /> In review
          </span>
          <span className="flex items-center gap-2">
            <StatusDot color="var(--success)" group="completed" /> Done
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          {(["urgent", "high", "medium", "low", "none"] as Priority[]).map((p) => (
            <PriorityIcon key={p} priority={p} showLabel />
          ))}
        </div>
      </Section>

      <Section title="Form controls">
        <Card className="grid gap-5 p-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-title">Task title</Label>
            <Input id="sg-title" defaultValue="Set up Stripe subscriptions & webhooks" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-email">Email</Label>
            <Input
              id="sg-email"
              defaultValue="sara@"
              aria-invalid="true"
              aria-describedby="sg-email-err"
            />
            <FieldError id="sg-email-err">Enter a valid email address.</FieldError>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <Select
              aria-label="Priority"
              value={priority}
              onValueChange={(v) => setPriority(v as Priority)}
              options={(["urgent", "high", "medium", "low", "none"] as Priority[]).map((p) => ({
                value: p,
                label: <PriorityIcon priority={p} showLabel />,
              }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sg-desc">Description</Label>
            <Textarea
              id="sg-desc"
              rows={2}
              defaultValue="Handle checkout.session.completed and cancellations."
            />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={done} onCheckedChange={(v) => setDone(v === true)} /> Verify
              webhook signatures
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <Switch defaultChecked /> Automation on
            </label>
          </div>
          <div className="text-muted flex items-center gap-2 text-sm">
            Open command palette <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </div>
        </Card>
      </Section>

      <Section title="Navigation, menus and overlays">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs defaultValue="board">
            <TabsList aria-label="Views">
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
          </Tabs>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Task actions</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>MOB-136</DropdownMenuLabel>
              <DropdownMenuItem>
                Copy link <DropdownMenuShortcut>⌘L</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive>
                <Trash2 /> Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>Delete this task?</DialogTitle>
                <DialogDescription>
                  MOB-136 and its 5 subtasks will move to the trash.
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="text-fg-2 text-[13px]">
                You can restore it from Archive for 30 days.
              </DialogBody>
              <DialogFooter>
                <Button variant="ghost">Cancel</Button>
                <Button variant="danger">Delete</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Tooltip content="Copy task link">
            <Button variant="ghost" size="icon" aria-label="Copy task link">
              <Paperclip />
            </Button>
          </Tooltip>

          <Button variant="secondary" onClick={() => toast.success("Task moved to In review")}>
            Show toast
          </Button>
        </div>
      </Section>

      <Section title="Cards, avatars and progress">
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article className="border-border bg-card flex flex-col gap-2.5 rounded-[10px] border p-3">
            <div className="flex items-center gap-2">
              <span className="text-subtle flex-1 font-mono text-[11px]">MOB-136</span>
              <PriorityIcon priority="urgent" showLabel />
            </div>
            <p className="leading-5 font-medium">Set up Stripe subscriptions &amp; webhooks</p>
            <div className="flex gap-1.5">
              <Badge tone="warning">Payments</Badge>
              <Badge tone="violet">Backend</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={60} label="Subtasks" />
              <span className="text-muted text-[11px]">3/5</span>
            </div>
            <div className="text-muted flex items-center gap-3 text-xs">
              <span className="text-danger-text flex items-center gap-1">
                <CalendarDays className="size-3.5" /> Today
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="size-3.5" /> 9
              </span>
              <span className="flex items-center gap-1">
                <Paperclip className="size-3.5" /> 2
              </span>
              <span className="flex-1" />
              <Avatar name="Hamza Faisal" seed="u1" size={24} />
            </div>
          </article>

          <Card className="flex flex-col gap-4 p-4">
            <AvatarStack people={team} max={3} />
            <div className="flex flex-col gap-2">
              <div className="flex text-[13px]">
                <span className="flex-1">AI credits this month</span>
                <span className="text-muted">72 of 200</span>
              </div>
              <Progress value={36} tone="info" label="AI credits used" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </Card>

          <Card>
            <EmptyState
              icon={<Sparkles />}
              title="No tasks yet"
              description="Create your first task or let AI draft a plan from a short brief."
              action={
                <Button size="sm">
                  <Plus /> New task
                </Button>
              }
            />
          </Card>
        </div>
      </Section>
    </div>
  );
}
