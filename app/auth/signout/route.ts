import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  const url = new URL(request.url);
  const { supabase, applyPendingCookies } = await createRouteSupabase();
  await supabase.auth.signOut();
  return applyPendingCookies(NextResponse.redirect(new URL("/login", url.origin), { status: 303 }));
}
