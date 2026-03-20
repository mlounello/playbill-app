import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCurrentUserWithProfile } from "@/lib/auth";
import { APP_SCHEMA, getMissingSupabaseEnvVars } from "@/lib/supabase";

function isStaffRole(role: string | null | undefined) {
  return role === "owner" || role === "admin" || role === "editor";
}

export async function GET() {
  const current = await getCurrentUserWithProfile();
  const role = current?.profile.platform_role ?? null;
  const isStaff = isStaffRole(role);

  const missing = getMissingSupabaseEnvVars();
  if (!isStaff) {
    if (missing.length > 0) {
      return NextResponse.json({ ok: false, status: "degraded" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, status: "ok" });
  }

  const base = {
    ok: false,
    schema: APP_SCHEMA,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      REMINDER_FROM_EMAIL: Boolean(process.env.REMINDER_FROM_EMAIL),
      DISABLE_OUTBOUND_EMAIL: /^(1|true|yes|on)$/i.test(String(process.env.DISABLE_OUTBOUND_EMAIL ?? "").trim()),
      CRON_SECRET: Boolean(process.env.CRON_SECRET)
    }
  };

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ...base,
        reason: "missing_env",
        missing
      },
      { status: 500 }
    );
  }

  try {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
      db: { schema: APP_SCHEMA }
    });
    const db = client.schema(APP_SCHEMA);

    const [programsCheck, showsCheck, peopleCheck] = await Promise.all([
      db.from("programs").select("id", { count: "exact", head: true }),
      db.from("shows").select("id", { count: "exact", head: true }),
      db.from("people").select("id", { count: "exact", head: true })
    ]);

    if (programsCheck.error || showsCheck.error || peopleCheck.error) {
      const checks = {
        programs: programsCheck.error
          ? {
              message: programsCheck.error.message,
              code: (programsCheck.error as { code?: string }).code ?? null,
              details: (programsCheck.error as { details?: string }).details ?? null,
              hint: (programsCheck.error as { hint?: string }).hint ?? null
            }
          : { ok: true },
        shows: showsCheck.error
          ? {
              message: showsCheck.error.message,
              code: (showsCheck.error as { code?: string }).code ?? null,
              details: (showsCheck.error as { details?: string }).details ?? null,
              hint: (showsCheck.error as { hint?: string }).hint ?? null
            }
          : { ok: true },
        people: peopleCheck.error
          ? {
              message: peopleCheck.error.message,
              code: (peopleCheck.error as { code?: string }).code ?? null,
              details: (peopleCheck.error as { details?: string }).details ?? null,
              hint: (peopleCheck.error as { hint?: string }).hint ?? null
            }
          : { ok: true }
      };
      return NextResponse.json(
        {
          ...base,
          reason: "supabase_query_failed",
          error: programsCheck.error?.message || showsCheck.error?.message || peopleCheck.error?.message || "Unknown query error",
          checks
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      env: base.env,
      reason: "connected",
      checks: {
        programs_table: "ok",
        shows_table: "ok",
        people_table: "ok"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ...base,
        reason: "supabase_init_failed",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
