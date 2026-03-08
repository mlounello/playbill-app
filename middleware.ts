import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  if (url.searchParams.has("code") && url.pathname !== "/auth/callback") {
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
