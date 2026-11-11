import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cleanKey } from "@/lib/env";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth",
  "/api",
  "/f/",
  "/styleguide",
  "/pricing",
];

const isPublic = (path: string) => path === "/" || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
const isAuthPage = (path: string) =>
  ["/login", "/signup", "/forgot-password"].some((p) => path.startsWith(p));

/** Refreshes the session cookie on every request and guards the app routes. */
export async function updateSession(request: NextRequest) {
  const url = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anonKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Checks the session token (and refreshes it when it has expired). getClaims verifies the token's
  // signature locally with the project's published keys, so most requests skip a network round trip;
  // pages still confirm the user with getUser before reading data. Don't run code between client
  // creation and this call.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? { id: data.claims.sub } : null;
  const path = request.nextUrl.pathname;

  if (!user && !isPublic(path)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }
  if (user && isAuthPage(path)) {
    const home = request.nextUrl.clone();
    home.pathname = "/app";
    home.search = "";
    return NextResponse.redirect(home);
  }
  return response;
}
