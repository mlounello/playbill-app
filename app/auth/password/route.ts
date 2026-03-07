import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureUserProfileIdentity } from "@/lib/auth";

type PendingCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

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
  const supabase = createServerClient(url, anon, {
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

  function applyPendingCookies(response: NextResponse) {
    for (const cookie of pending) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  }

  return { supabase, applyPendingCookies };
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

  const { supabase, applyPendingCookies } = await createRouteSupabase();

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

  const { error } = await supabase.auth.signInWithPassword({ email, password });
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

  return applyPendingCookies(
    redirect303(new URL(`${nextPath}${nextPath.includes("?") ? "&" : "?"}auth=success`, origin))
  );
}
