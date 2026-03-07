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

function toBase64Url(value: string) {
  return Buffer.from(value, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeSessionCookieValue(session: unknown) {
  return `base64-${toBase64Url(JSON.stringify(session))}`;
}

function redirect303(url: URL) {
  return NextResponse.redirect(url, { status: 303 });
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

  function applyPendingCookies(response: NextResponse, fallbackAuthCookie?: { name: string; value: string; secure: boolean }) {
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

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const mode = String(formData.get("mode") ?? "signin").toLowerCase();
  const nextPath = String(formData.get("next") ?? "/app/shows");
  const origin = new URL(request.url).origin;

  if (!email || !password) {
    return redirect303(new URL("/login?error=Email+and+password+are+required", origin));
  }

  const { supabase, applyPendingCookies, cookieName } = await createRouteSupabase();

  if (mode === "signup") {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      }
    });
    if (error) {
      return applyPendingCookies(redirect303(new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)));
    }
    return applyPendingCookies(
      redirect303(new URL("/login?success=Account+created.+Check+your+email+if+confirmation+is+enabled.", origin))
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return applyPendingCookies(redirect303(new URL(`/login?error=${encodeURIComponent(error.message)}`, origin)));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user?.id && user?.email) {
    try {
      await ensureUserProfileIdentity(user.id, user.email);
    } catch {
      // Do not block auth completion if profile bootstrap has an issue.
    }
  }

  const fallbackAuthCookie =
    cookieName && data?.session
      ? {
          name: cookieName,
          value: encodeSessionCookieValue(data.session),
          secure: new URL(origin).protocol === "https:"
        }
      : undefined;

  return applyPendingCookies(
    redirect303(new URL(`${nextPath}${nextPath.includes("?") ? "&" : "?"}auth=success`, origin)),
    fallbackAuthCookie
  );
}
