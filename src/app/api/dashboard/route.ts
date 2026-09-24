import { fixtureReadAllowed, ok } from "@/lib/api-fixture";
import { getDashboard } from "@/lib/fixture-db";
import { isFixtureMode } from "@/lib/data-source";
import { dbDashboard } from "@/lib/db-read";

export async function GET(): Promise<Response> {
  return isFixtureMode() ? fixtureReadAllowed() ?? ok(getDashboard()) : dbDashboard();
}
