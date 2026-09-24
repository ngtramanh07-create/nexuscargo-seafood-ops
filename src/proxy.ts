import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { hasSupabaseConfig, isFixtureMode } from "@/lib/data-source";

/** Refresh the verified cookie session before database-backed API requests. */
export async function proxy(request: NextRequest) {
  if (isFixtureMode() || !hasSupabaseConfig()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) {
          for (const { name, value } of items) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of items) response.cookies.set(name, value, options);
        },
      },
    },
  );
  await client.auth.getClaims();
  return response;
}

export const config = { matcher: "/api/:path*" };
