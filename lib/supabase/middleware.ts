import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthCookieName } from "@/lib/supabase";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return response;
  }
  const cookieName = getSupabaseAuthCookieName(url);

  const supabase = createServerClient(url, anon, {
    ...(cookieName ? { cookieOptions: { name: cookieName } } : {}),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
        }

        response = NextResponse.next({ request });
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      }
    }
  });

  await supabase.auth.getUser();

  return response;
}
