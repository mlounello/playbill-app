import { NextResponse } from "next/server";
import { ensureUserProfileIdentity } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/app/shows";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user?.id && user?.email) {
        await ensureUserProfileIdentity(user.id, user.email);
      }

      const redirectUrl = new URL(next, origin);
      redirectUrl.searchParams.set("auth", "success");
      const response = NextResponse.redirect(redirectUrl);
      response.headers.set("Cache-Control", "no-store, max-age=0");
      return response;
    }
  }

  return NextResponse.redirect(new URL("/app/login?error=Could+not+authenticate", origin));
}
