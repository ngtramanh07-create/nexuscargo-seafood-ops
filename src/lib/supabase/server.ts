import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Publishable key + the caller's cookie session; the service key is NEVER used in API reads. */
export async function createUserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase chưa được cấu hình.");
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(items) {
        for (const { name, value, options } of items) store.set(name, value, options);
      },
    },
  });
}
