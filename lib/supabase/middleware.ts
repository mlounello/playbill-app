import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthCookieName } from "@/lib/supabase";

type SessionRefreshResult = {
  response: NextResponse;
  user: { id: string; email?: string | null } | null;
};

function isSupabaseAuthCookieName(name: string) {
  return /^sb-[a-z0-9]+-auth-token(?:\..+)?$/i.test(name) || /^sb-[a-z0-9]+-auth-token-code-verifier$/i.test(name);
}

function cookieBelongsToExpectedProject(name: string, expectedBase: string | null) {
  if (!expectedBase) {
    return true;
  }
  return name === expectedBase || name.startsWith(`${expectedBase}.`) || name === `${expectedBase}-code-verifier`;
}

export async function updateSession(request: NextRequest): Promise<SessionRefreshResult> {
  let response = NextResponse.next({
    request
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return { response, user: null };
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

  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Clean up stale auth cookies from other Supabase projects to avoid cross-project
  // session confusion (e.g., old sb-<other-ref>-auth-token cookies persisting).
  for (const cookie of request.cookies.getAll()) {
    if (!isSupabaseAuthCookieName(cookie.name)) {
      continue;
    }
    if (cookieBelongsToExpectedProject(cookie.name, cookieName)) {
      continue;
    }
    response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
  }

  return { response, user };
}
