/** Only development mode may serve the unauthenticated synthetic fixture. */
export function isFixtureMode(): boolean {
  return process.env.NODE_ENV === "development" && process.env.NEXUSCARGO_DATA_SOURCE !== "supabase";
}

export function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
