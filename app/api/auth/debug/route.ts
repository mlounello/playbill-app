import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolvePlatformRoleForUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { APP_SCHEMA } from "@/lib/supabase";

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
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (!user || !user.email) {
      const db = supabase.schema(APP_SCHEMA);
      const { data: testPrograms, error: testProgramsError } = await db.from("programs").select("id").limit(1);
      return NextResponse.json({
        ok: true,
        logged_in: false,
        user: null,
        session_present: Boolean(session),
        cookie_names: cookieNames,
        auth_cookie_diagnostics: authCookieDiagnostics,
        schema_read_ok: !testProgramsError,
        schema_read_error: testProgramsError?.message ?? null,
        schema_read_count: Array.isArray(testPrograms) ? testPrograms.length : 0,
        user_error: userError?.message ?? null,
        session_error: sessionError?.message ?? null
      });
    }

    const role = await resolvePlatformRoleForUser({ supabase, userId: user.id, email: user.email });
    return NextResponse.json({
      ok: true,
      logged_in: true,
      user: { id: user.id, email: user.email },
      session_present: Boolean(session),
      cookie_names: cookieNames,
      auth_cookie_diagnostics: authCookieDiagnostics,
      resolved_role: role,
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
