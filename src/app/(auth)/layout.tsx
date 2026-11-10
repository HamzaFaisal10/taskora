import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { AuthShowcase } from "@/components/auth/showcase";
import { ThemeToggle } from "@/components/theme";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="Taskora home">
            <Logo size={26} />
          </Link>
          <ThemeToggle />
        </header>
        <main className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <footer className="text-subtle text-center text-xs">
          © {new Date().getFullYear()} Taskora
        </footer>
      </div>
      <AuthShowcase />
    </div>
  );
}
