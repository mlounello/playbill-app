import { NextResponse } from "next/server";
import { ensureUserProfileIdentity } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const mode = String(formData.get("mode") ?? "signin").toLowerCase();
  const nextPath = String(formData.get("next") ?? "/app/shows");
  const origin = new URL(request.url).origin;

  if (!email || !password) {
    return NextResponse.redirect(new URL("/app/login?error=Email+and+password+are+required", origin));
  }

  const supabase = await createSupabaseServerClient();

  if (mode === "signup") {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      }
    });
    if (error) {
      return NextResponse.redirect(new URL(`/app/login?error=${encodeURIComponent(error.message)}`, origin));
    }
    return NextResponse.redirect(
      new URL("/app/login?success=Account+created.+Check+your+email+if+confirmation+is+enabled.", origin)
    );
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.redirect(new URL(`/app/login?error=${encodeURIComponent(error.message)}`, origin));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user?.id && user?.email) {
    await ensureUserProfileIdentity(user.id, user.email);
  }

  return NextResponse.redirect(new URL(`${nextPath}${nextPath.includes("?") ? "&" : "?"}auth=success`, origin));
}
