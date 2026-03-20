import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUserWithProfile, resolvePlatformRoleForUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthCookieName } from "@/lib/supabase";

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function tryDecodeBase64Url(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

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
      const raw = cookie.value;
      const rawPreview = raw.slice(0, 24);
      const rawJson = safeJsonParse(raw);
      const decoded = tryDecodeBase64Url(raw);
      const decodedJson = decoded ? safeJsonParse(decoded) : null;
      return {
        name: cookie.name,
        length: raw.length,
        preview: rawPreview,
        parsed_raw_json: Boolean(rawJson),
        decoded_length: decoded?.length ?? 0,
        parsed_decoded_json: Boolean(decodedJson)
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
