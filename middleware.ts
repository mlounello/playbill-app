import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function isProtectedPath(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/") || pathname === "/contribute" || pathname.startsWith("/contribute/");
}

function applySecurityHeaders(response: NextResponse, pathname: string) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (pathname === "/preview") {
    response.headers.delete("X-Frame-Options");
    response.headers.set("Content-Security-Policy", "frame-ancestors 'self' https://mlounello.com");
    return response;
  }

  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  return response;
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
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  const { response, user } = await updateSession(request);

  if (pathname === "/preview") {
    return applySecurityHeaders(response, pathname);
  }

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);
    return applySecurityHeaders(NextResponse.redirect(loginUrl), pathname);
  }

  return applySecurityHeaders(response, pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
