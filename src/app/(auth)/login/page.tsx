import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <LoginForm
      next={typeof next === "string" ? next : undefined}
      error={typeof error === "string" ? error : undefined}
    />
  );
}
