import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolvePlatformRoleForUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);
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
      return NextResponse.json({
        ok: true,
        logged_in: false,
        user: null,
        session_present: Boolean(session),
        cookie_names: cookieNames,
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
