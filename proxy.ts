import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isLocalMode,
  LOCAL_SESSION_COOKIE,
  POS_SCHEMA,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "@/lib/pos/config";

const PROTECTED_PREFIXES = ["/pos", "/admin", "/orders", "/driver", "/bill"];

function redirectToLogin(request: NextRequest, pathname: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

function redirectToPos(request: NextRequest) {
  const posUrl = request.nextUrl.clone();
  posUrl.pathname = "/pos";
  posUrl.search = "";
  return NextResponse.redirect(posUrl);
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isLocalMode()) {
    const hasSession = Boolean(request.cookies.get(LOCAL_SESSION_COOKIE)?.value);
    if (!hasSession && isProtected) return redirectToLogin(request, pathname);
    if (hasSession && pathname === "/login") return redirectToPos(request);
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

  if (!user && isProtected) return redirectToLogin(request, pathname);
  if (user && pathname === "/login") return redirectToPos(request);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
