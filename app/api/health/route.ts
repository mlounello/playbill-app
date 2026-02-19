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
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
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

    const { error } = await client.from("programs").select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          ...base,
          reason: "supabase_query_failed",
          error: error.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, env: base.env, reason: "connected" });
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
