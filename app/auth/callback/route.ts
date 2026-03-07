import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureUserProfileIdentity } from "@/lib/auth";
import { getSupabaseAuthCookieName } from "@/lib/supabase";

type PendingCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

async function createRouteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing Supabase public environment variables.");
  }

  const cookieStore = await cookies();
  const pending: PendingCookie[] = [];
  const cookieName = getSupabaseAuthCookieName(url);
  const supabase = createServerClient(url, anon, {
    ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
    cookies: {
      getAll() {
        // Next.js route handlers often cannot mutate the request cookie store.
        // Supabase will call setAll() during the auth exchange; we queue those
        // cookies in `pending` and also expose them here so subsequent reads
        // (getSession/getUser) within the same request can see the new session.
        const existing = cookieStore.getAll();
        if (pending.length === 0) return existing;

        const byName = new Map(existing.map((c) => [c.name, c]));
        for (const c of pending) {
          // Cast is safe: Supabase cookie shape is compatible with Next cookies.
          byName.set(c.name, c as unknown as (typeof existing)[number]);
        }
        return Array.from(byName.values());
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          try {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          } catch {
            // Best-effort immediate write; redirect response also receives cookies below.
          }
          pending.push({
            name: cookie.name,
            value: cookie.value,
            options: cookie.options
          });
        }
      }
    }
  });

  function applyPendingCookies(response: NextResponse) {
    response.cookies.set("playbill_callback_hit", String(Date.now()), {
      path: "/",
      sameSite: "lax",
      secure: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://playbillapp.mlounello.com").protocol === "https:",
      maxAge: 60 * 10
    });
    for (const cookie of pending) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  }

  return { supabase, applyPendingCookies, cookieName };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") || "/app/shows";
  logCallback("received", {
    has_code: Boolean(code),
    has_token_hash: Boolean(tokenHash),
    type: type ?? null,
    next
  });

  const { supabase, applyPendingCookies, cookieName } = await createRouteSupabase();
  let authError: string | null = null;
  let session: any | null = null;
  let user: any | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error?.message ?? null;
    session = data?.session ?? null;
    user = data?.user ?? null;
    logCallback("exchange_code_for_session", {
      ok: !error,
      error: error?.message ?? null,
      has_session: Boolean(session),
      user_id: user?.id ?? null,
      email: user?.email ?? null
    });
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "recovery" | "invite" | "signup" | "email_change" | "email"
    });
    authError = error?.message ?? null;
    session = data?.session ?? null;
    user = data?.user ?? null;
    logCallback("verify_otp", {
      ok: !error,
      error: error?.message ?? null,
      has_session: Boolean(session),
      user_id: user?.id ?? null,
      email: user?.email ?? null
    });
  } else {
    logCallback("missing_callback_params", { has_code: false, has_token_hash: Boolean(tokenHash), type: type ?? null });
  }

  if (!authError && (code || (tokenHash && type))) {
    if (user?.id && user?.email) {
      try {
        await ensureUserProfileIdentity(user.id, user.email);
      } catch {
        // Do not block auth completion if profile bootstrap has an issue.
      }
    }

    const redirectUrl = new URL(next, origin);
    redirectUrl.searchParams.set("auth", "success");
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Cache-Control", "no-store, max-age=0");

    // IMPORTANT: rely on Supabase-set cookies (via pending) rather than writing
    // a custom, long-lived session cookie. This avoids format/HttpOnly issues.
    return applyPendingCookies(response);
  }

  logCallback("callback_failed", { error: authError ?? "invalid_callback_params" });
  const redirect = new URL("/login?error=Could+not+authenticate", origin);
  if (authError) {
    redirect.searchParams.set("auth_error", authError);
  }
  const failedResponse = NextResponse.redirect(redirect);
  failedResponse.cookies.set("playbill_callback_hit", String(Date.now()), {
    path: "/",
    sameSite: "lax",
    secure: new URL(origin).protocol === "https:",
    maxAge: 60 * 10
  });
  return failedResponse;
}

function logCallback(event: string, details: Record<string, unknown>) {
  console.info("[auth/callback]", event, details);
}
