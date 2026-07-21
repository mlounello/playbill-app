import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUserWithProfile, resolvePlatformRoleForUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthCookieName } from "@/lib/supabase";

export async function GET() {
  try {
    const current = await getCurrentUserWithProfile();
    const role = current?.profile.platform_role ?? null;
    const isStaff = role === "owner" || role === "admin" || role === "editor";

    if (!current) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!isStaff) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieNames = allCookies.map((cookie) => cookie.name);
    const authCookies = allCookies.filter((cookie) => cookie.name.includes("auth-token"));
    const authCookieDiagnostics = authCookies.map((cookie) => {
      return {
        name: cookie.name,
        present: cookie.value.length > 0,
        length: cookie.value.length
      };
    });
    const callbackHitCookie = cookieStore.get("playbill_callback_hit")?.value ?? null;
    const expectedCookieName = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? getSupabaseAuthCookieName(process.env.NEXT_PUBLIC_SUPABASE_URL)
      : null;

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    const resolvedRole =
      user && user.email
        ? await resolvePlatformRoleForUser({ supabase, userId: user.id, email: user.email })
        : null;

    return NextResponse.json({
      ok: true,
      logged_in: Boolean(user),
      user: user ? { id: user.id, email: user.email ?? null } : null,
      session_present: Boolean(session),
      cookie_names: cookieNames,
      callback_hit_cookie: callbackHitCookie,
      expected_cookie_name: expectedCookieName,
      auth_cookie_diagnostics: authCookieDiagnostics,
      resolved_role: resolvedRole,
      user_error: userError?.message ?? null,
      session_error: sessionError?.message ?? null
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "auth_debug_failed" },
      { status: 500 }
    );
  }
}
