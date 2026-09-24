/** Public demo uses the bundled synthetic fixture, never the protected database. */
export function isPublicDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_NEXUSCARGO_PUBLIC_DEMO === "true";
}

export function isFixtureMode(): boolean {
  return isPublicDemoMode() || process.env.NODE_ENV === "development" && process.env.NEXUSCARGO_DATA_SOURCE !== "supabase";
}

export function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
