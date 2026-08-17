import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const programsSource = readFileSync(new URL("../lib/programs.ts", import.meta.url), "utf8");
const submissionsSource = readFileSync(new URL("../lib/submissions.ts", import.meta.url), "utf8");

test("biographies combine all roles held by one person", () => {
  const start = programsSource.indexOf("function derivePeopleForBiosFromRoles");
  const end = programsSource.indexOf("function buildRoleListRowsByCategory", start);
  const body = programsSource.slice(start, end);

  assert.match(body, /rolesByPersonId/);
  assert.match(body, /role_title: joinRoles\(nonCastRoles\)/);
  assert.match(body, /castRoleLine = joinRoles\(castRoles\)/);
});

test("team lists keep each show role as its own row", () => {
  const start = programsSource.indexOf("function buildRoleListRowsByCategory");
  const end = programsSource.indexOf("function buildProductionInfoHtml", start);
  const body = programsSource.slice(start, end);

  assert.match(body, /role: role\.role_name/);
  assert.match(body, /role: row\.role/);
  assert.doesNotMatch(body, /joinRoles\(row\.roles\)/);
});

test("Playbill resync moves submissions before deleting duplicate bio requests", () => {
  const start = submissionsSource.indexOf("export async function resyncShowSubmissionRequests");
  const body = submissionsSource.slice(start);
  const moveIndex = body.indexOf('from("submissions")');
  const deleteIndex = body.indexOf('from("submission_requests")', moveIndex);

  assert.notEqual(moveIndex, -1);
  assert.match(body, /update\(\{ request_id: keep\.id \}\)/);
  assert.ok(moveIndex < deleteIndex, "submitted material must move before duplicate cleanup");
});
