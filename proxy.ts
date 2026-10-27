import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isLocalMode,
  LOCAL_SESSION_COOKIE,
  POS_SCHEMA,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "@/lib/pos/config";

const CUSTOMER_PREFIXES = ["/orders", "/bill", "/profile"];
const STAFF_PREFIXES = ["/pos", "/admin", "/driver"];
const PROTECTED_PREFIXES = [...CUSTOMER_PREFIXES, ...STAFF_PREFIXES];
const AUTH_PATHS = [
  "/login",
  "/customer/login",
  "/customer/register",
  "/admin/login",
  "/driver/login",
  "/frontdesk/login",
  "/auth/callback",
];

type ActorRole = "ADMIN" | "MANAGER" | "FRONT_DESK" | "KITCHEN" | "DRIVER" | "CUSTOMER";

type Actor = { role: ActorRole; status: "ACTIVE" | "SUSPENDED" | "TERMINATED" } | null;

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.includes(pathname);
}

function loginPathFor(pathname: string): string {
  if (matchesPrefix(pathname, ["/admin"])) return "/admin/login";
  if (matchesPrefix(pathname, ["/driver"])) return "/driver/login";
  if (matchesPrefix(pathname, ["/pos"])) return "/frontdesk/login";
  return "/customer/login";
}

function defaultPathFor(role: ActorRole): string {
  if (role === "CUSTOMER") return "/profile";
  if (role === "DRIVER") return "/driver";
  if (role === "ADMIN") return "/admin";
  return "/pos";
}

function redirectTo(
  request: NextRequest,
  source: NextResponse,
  pathname: string,
  options?: { next?: string; reason?: string },
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (options?.next) url.searchParams.set("next", options.next);
  if (options?.reason) url.searchParams.set("reason", options.reason);

  const response = NextResponse.redirect(url);
  // Preserve any refreshed Supabase auth cookies written while calling getUser().
  for (const cookie of source.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}

function redirectToLogin(
  request: NextRequest,
  source: NextResponse,
  pathname: string,
): NextResponse {
  return redirectTo(request, source, loginPathFor(pathname), { next: pathname });
}

function canAccessProtectedPath(pathname: string, role: ActorRole): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return role === "ADMIN";
  }
  if (pathname === "/driver" || pathname.startsWith("/driver/")) {
    return role === "DRIVER" || role === "ADMIN";
  }
  if (pathname === "/pos" || pathname.startsWith("/pos/")) {
    return role !== "CUSTOMER";
  }
  // Customers and operational staff may view tracking and e-bills. RLS remains
  // the final authority over which individual orders are visible.
  return true;
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isProtected =
    !isAuthPath(pathname) && matchesPrefix(pathname, PROTECTED_PREFIXES);

  if (isLocalMode()) {
    const hasSession = Boolean(request.cookies.get(LOCAL_SESSION_COOKIE)?.value);
    if (!hasSession && isProtected) return redirectToLogin(request, response, pathname);
    if (hasSession && pathname === "/login") {
      return redirectTo(request, response, "/pos");
    }
    return response;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: POS_SCHEMA },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isProtected) return redirectToLogin(request, response, pathname);
    return response;
  }

  // Auth pages remain reachable so a user can intentionally switch accounts.
  // Role checks apply to the protected application surfaces below.
  if (!isProtected) return response;

  const { data: actorData } = await supabase
    .from("app_users")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  const actor = actorData as Actor;
  if (!actor) {
    return redirectTo(request, response, loginPathFor(pathname), {
      next: pathname,
      reason: "not-provisioned",
    });
  }
  if (actor.status !== "ACTIVE") {
    return redirectTo(request, response, loginPathFor(pathname), {
      next: pathname,
      reason: "inactive",
    });
  }
  if (!canAccessProtectedPath(pathname, actor.role)) {
    return redirectTo(request, response, defaultPathFor(actor.role));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
