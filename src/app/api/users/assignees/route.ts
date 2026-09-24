import { developmentOnly, ok } from "@/lib/api-fixture";
import { assignees } from "@/lib/fixture-db";
import { isFixtureMode } from "@/lib/data-source";
import { dbAssignees } from "@/lib/db-read";

export async function GET(): Promise<Response> {
  return isFixtureMode() ? developmentOnly() ?? ok(assignees) : dbAssignees();
}
