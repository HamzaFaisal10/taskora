"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import {
  sendResetLink,
  signIn,
  signInWithGoogle,
  signUp,
  updatePassword,
  type AuthState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Separator } from "@/components/ui/surface";

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  invalid,
  aside,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  invalid?: boolean;
  aside?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={name}>{label}</Label>
        {aside}
      </div>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "form-error" : undefined}
        required
      />
    </div>
  );
}

function Sent({ message }: { message: string }) {
  return (
    <div
      className="bg-success-soft text-success-text rounded-card flex gap-3 p-4 text-sm"
      role="status"
    >
      <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

export function DemoButton({ className }: { className?: string }) {
  return (
    <form action="/api/demo" method="post" className={className}>
      <Button type="submit" variant="ai" size="lg" className="w-full">
        Try the live demo — no sign-up
      </Button>
    </form>
  );
}

function GoogleButton({ next }: { next?: string }) {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH !== "1") return null;
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next ?? ""} />
      <Button type="submit" variant="secondary" size="lg" className="w-full">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
          />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path
            fill="#EA4335"
            d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z"
          />
        </svg>
        Continue with Google
      </Button>
    </form>
  );
}

function OrDivider() {
  return (
    <div className="text-subtle flex items-center gap-3 text-xs">
      <Separator className="flex-1" />
      or
      <Separator className="flex-1" />
    </div>
  );
}

const ERRORS: Record<string, string> = {
  demo: "The demo is being refreshed. Try again in a minute.",
  link: "That link is invalid or has expired. Request a new one.",
  google: "Google sign-in isn't available right now.",
};

export function LoginForm({ next, error: queryError }: { next?: string; error?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, undefined);
  const error = state?.error ?? (queryError ? ERRORS[queryError] : undefined);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted mt-1.5 text-sm">Sign in to your workspace.</p>
      </div>
      <DemoButton />
      <OrDivider />
      <GoogleButton next={next} />
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state?.fields?.email}
          invalid={!!state?.error}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          invalid={!!state?.error}
          aside={
            <Link href="/forgot-password" className="text-muted hover:text-fg text-xs">
              Forgot password?
            </Link>
          }
        />
        <FieldError id="form-error">{error}</FieldError>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>
      <p className="text-muted text-center text-sm">
        New to Taskora?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="text-fg font-medium hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, undefined);
  if (state?.message) return <Sent message={state.message} />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="text-muted mt-1.5 text-sm">Free for up to 5 people. No card needed.</p>
      </div>
      <GoogleButton next={next} />
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field
          label="Full name"
          name="name"
          autoComplete="name"
          defaultValue={state?.fields?.name}
        />
        <Field
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state?.fields?.email}
        />
        <Field label="Password" name="password" type="password" autoComplete="new-password" />
        <FieldError id="form-error">{state?.error}</FieldError>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Create account
        </Button>
      </form>
      <OrDivider />
      <DemoButton />
      <p className="text-muted text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-fg font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(sendResetLink, undefined);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-muted mt-1.5 text-sm">We’ll email you a link to choose a new one.</p>
      </div>
      {state?.message ? (
        <Sent message={state.message} />
      ) : (
        <form action={action} className="space-y-4" noValidate>
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            invalid={!!state?.error}
          />
          <FieldError id="form-error">{state?.error}</FieldError>
          <Button type="submit" size="lg" className="w-full" loading={pending}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="text-muted text-center text-sm">
        <Link href="/login" className="text-fg font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, undefined);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-muted mt-1.5 text-sm">At least 8 characters.</p>
      </div>
      <form action={action} className="space-y-4" noValidate>
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          invalid={!!state?.error}
        />
        <Field
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          invalid={!!state?.error}
        />
        <FieldError id="form-error">{state?.error}</FieldError>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Update password
        </Button>
      </form>
    </div>
  );
}
