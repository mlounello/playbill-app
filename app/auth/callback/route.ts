import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureUserProfileIdentity } from "@/lib/auth";

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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/app/shows";

  if (code) {
    const { supabase, applyPendingCookies } = await createRouteSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user?.id && user?.email) {
        await ensureUserProfileIdentity(user.id, user.email);
      }

      const redirectUrl = new URL(next, origin);
      redirectUrl.searchParams.set("auth", "success");
      const response = NextResponse.redirect(redirectUrl);
      response.headers.set("Cache-Control", "no-store, max-age=0");
      return applyPendingCookies(response);
    }
  }

  return NextResponse.redirect(new URL("/login?error=Could+not+authenticate", origin));
}
