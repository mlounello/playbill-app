import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // If Supabase drops us on the site root with a code, forward it into the callback route
  if (url.pathname === "/" && url.searchParams.has("code")) {
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"]
};