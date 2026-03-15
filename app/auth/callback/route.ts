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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

async function createRouteSupabase(origin: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing Supabase public environment variables.");
  }

  const isSecure = new URL(origin).protocol === "https:";

  const cookieStore = await cookies();
  const pending: PendingCookie[] = [];
  const cookieName = getSupabaseAuthCookieName(url);

  const supabase = createServerClient(url, anon, {
    cookieOptions: {
      ...(cookieName ? { name: cookieName } : {}),
      path: "/",
      sameSite: "lax",
      secure: isSecure
    },
    cookies: {
      getAll() {
        const existing = cookieStore.getAll();
        if (pending.length === 0) return existing;

        const byName = new Map(existing.map((c) => [c.name, c]));
        for (const c of pending) {
          byName.set(c.name, c as unknown as (typeof existing)[number]);
        }
        return Array.from(byName.values());
      },
      setAll(cookiesToSet) {
        console.info(
          "[auth/callback] setAll",
          cookiesToSet.map((c: any) => ({ name: c.name, hasOptions: Boolean(c.options) }))
        );

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
      secure: isSecure,
      maxAge: 60 * 10
    });

    for (const cookie of pending) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    // Clear pb_next after we’ve used it
    response.cookies.set("pb_next", "", {
      path: "/",
      sameSite: "lax",
      secure: isSecure,
      maxAge: 0
    });

    return response;
  }

  return { supabase, applyPendingCookies, cookieName };
}

function readNextFromCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const pbNext = cookieStore.get("pb_next")?.value;
  if (!pbNext) return null;

  try {
    const decoded = decodeURIComponent(pbNext);
    if (!decoded.startsWith("/")) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const cookieStore = await cookies();
  const nextFromQuery = searchParams.get("next");
  const nextFromCookie = readNextFromCookie(cookieStore);
  const next = nextFromQuery || nextFromCookie || "/app/shows";

  logCallback("received", {
    has_code: Boolean(code),
    has_token_hash: Boolean(tokenHash),
    type: type ?? null,
    next
  });

  const { supabase, applyPendingCookies } = await createRouteSupabase(origin);
  let authError: string | null = null;
  let session: any | null = null;
  let user: any | null = null;

  if (code) {
    try {
      const { data, error } = await withTimeout(supabase.auth.exchangeCodeForSession(code), 15_000, "exchange_code");
      authError = error?.message ?? null;
      session = data?.session ?? null;
      user = data?.user ?? null;
    } catch (error) {
      authError = error instanceof Error ? error.message : "exchange_code_failed";
    }

    logCallback("exchange_code_for_session", {
      ok: !authError,
      error: authError,
      has_session: Boolean(session),
      user_id: user?.id ?? null,
      email: user?.email ?? null
    });
  } else if (tokenHash && type) {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "magiclink" | "recovery" | "invite" | "signup" | "email_change" | "email"
        }),
        15_000,
        "verify_otp"
      );
      authError = error?.message ?? null;
      session = data?.session ?? null;
      user = data?.user ?? null;
    } catch (error) {
      authError = error instanceof Error ? error.message : "verify_otp_failed";
    }

    logCallback("verify_otp", {
      ok: !authError,
      error: authError,
      has_session: Boolean(session),
      user_id: user?.id ?? null,
      email: user?.email ?? null
    });
  } else {
    logCallback("missing_callback_params", {
      has_code: false,
      has_token_hash: Boolean(tokenHash),
      type: type ?? null
    });
  }

  if (!authError && (code || (tokenHash && type))) {
    if (user?.id && user?.email) {
      try {
        await withTimeout(ensureUserProfileIdentity(user.id, user.email), 5_000, "profile_bootstrap");
      } catch {
        // Do not block auth completion if profile bootstrap has an issue.
      }
    }

    const redirectUrl = new URL(next, origin);
    redirectUrl.searchParams.set("auth", "success");

    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("Cache-Control", "no-store, max-age=0");
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

  // Clear pb_next on failure too
  failedResponse.cookies.set("pb_next", "", {
    path: "/",
    sameSite: "lax",
    secure: new URL(origin).protocol === "https:",
    maxAge: 0
  });

  return failedResponse;
}

function logCallback(event: string, details: Record<string, unknown>) {
  console.info("[auth/callback]", event, details);
}
