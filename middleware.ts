import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function isProtectedPath(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/") || pathname === "/contribute" || pathname.startsWith("/contribute/");
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hasAuthCallbackParams =
    url.searchParams.has("code") || (url.searchParams.has("token_hash") && url.searchParams.has("type"));
  if (hasAuthCallbackParams && url.pathname !== "/auth/callback") {
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
