import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getMissingSupabaseEnvVars } from "@/lib/supabase";

export async function GET() {
  const missing = getMissingSupabaseEnvVars();
  const base = {
    ok: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      REMINDER_FROM_EMAIL: Boolean(process.env.REMINDER_FROM_EMAIL),
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
      auth: { persistSession: false }
    });

    const [programsCheck, showsCheck, peopleCheck] = await Promise.all([
      client.from("programs").select("id", { count: "exact", head: true }),
      client.from("shows").select("id", { count: "exact", head: true }),
      client.from("people").select("id", { count: "exact", head: true })
    ]);

    if (programsCheck.error || showsCheck.error || peopleCheck.error) {
      return NextResponse.json(
        {
          ...base,
          reason: "supabase_query_failed",
          error: programsCheck.error?.message || showsCheck.error?.message || peopleCheck.error?.message || "Unknown query error"
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
