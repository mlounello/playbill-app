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

type FallbackAuthCookie = { name: string; value: string; secure: boolean };

function toBase64Url(value: string) {
  return Buffer.from(value, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeSessionCookieValue(session: unknown) {
  return `base64-${toBase64Url(JSON.stringify(session))}`;
}

function logCallback(event: string, details: Record<string, unknown>) {
  console.info("[auth/callback]", event, details);
}

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
        return cookieStore.getAll();
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

  function applyPendingCookies(response: NextResponse, fallbackAuthCookie?: FallbackAuthCookie) {
    for (const cookie of pending) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    if (fallbackAuthCookie) {
      const alreadySet = pending.some(
        (cookie) => cookie.name === fallbackAuthCookie.name || cookie.name.startsWith(`${fallbackAuthCookie.name}.`)
      );
      if (!alreadySet) {
        response.cookies.set(fallbackAuthCookie.name, fallbackAuthCookie.value, {
          path: "/",
          sameSite: "lax",
          secure: fallbackAuthCookie.secure,
          maxAge: 60 * 60 * 24 * 365
        });
      }
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

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error?.message ?? null;
    logCallback("exchange_code_for_session", { ok: !error, error: error?.message ?? null });
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "recovery" | "invite" | "signup" | "email_change" | "email"
    });
    authError = error?.message ?? null;
    logCallback("verify_otp", { ok: !error, error: error?.message ?? null });
  } else {
    logCallback("missing_callback_params", { has_code: false, has_token_hash: Boolean(tokenHash), type: type ?? null });
  }

  if (!authError && (code || (tokenHash && type))) {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    const {
      data: { user },
      error: getUserError
    } = await supabase.auth.getUser();
    logCallback("post_callback_user", {
      has_session: Boolean(session),
      user_id: user?.id ?? null,
      email: user?.email ?? null,
      user_error: getUserError?.message ?? null
    });

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
    const fallbackAuthCookie: FallbackAuthCookie | undefined =
      cookieName && session
        ? {
            name: cookieName,
            value: encodeSessionCookieValue(session),
            secure: new URL(origin).protocol === "https:"
          }
        : undefined;
    return applyPendingCookies(response, fallbackAuthCookie);
  }

  logCallback("callback_failed", { error: authError ?? "invalid_callback_params" });
  return NextResponse.redirect(new URL("/login?error=Could+not+authenticate", origin));
}
