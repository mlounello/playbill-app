import { NextResponse } from "next/server";
import { ensureUserProfileIdentity } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/app/shows";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user?.id && user?.email) {
      await ensureUserProfileIdentity(user.id, user.email);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
