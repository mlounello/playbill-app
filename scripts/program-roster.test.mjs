import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/programs.ts", import.meta.url), "utf8");
const start = source.indexOf("function filterProgramPeopleByRoles(");
const end = source.indexOf("function derivePeopleForBiosFromRoles(", start);
assert.ok(start >= 0 && end > start);
const compiled = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
const filterPeople = vm.runInNewContext(`${compiled}\nfilterProgramPeopleByRoles;`);

const imported = {
  id: "emily", full_name: "Emily Rose Rivera", bio: "Her submitted biography.",
  submission_source: "production_management", production_management_person_id: "pm-emily"
};
const standalone = { id: "legacy", full_name: "Standalone Contributor", bio: "Saved bio." };

test("a removed PM contributor is excluded while their original bio remains intact", () => {
  const people = [imported, standalone];
  const before = JSON.stringify(people);
  const result = filterPeople(people, [{ person_id: "someone-else" }]);
  assert.equal(result.length, 0);
  assert.equal(JSON.stringify(people), before);
});

test("vacant roles do not bring removed contributors back into the program", () => {
  assert.equal(filterPeople([imported], [{ person_id: "" }, { person_id: null }]).length, 0);
});

test("removing the last assignment excludes all imported contributors even with an empty roster", () => {
  assert.deepEqual(filterPeople([imported, standalone], []).map((p) => p.id), ["legacy"]);
});

test("a contributor with another remaining role stays included once", () => {
  const result = filterPeople([imported], [{ person_id: "emily" }, { person_id: "emily" }]);
  assert.equal(result.length, 1);
  assert.equal(result[0], imported);
});

test("standalone bios remain supported without show-role assignments", () => {
  assert.equal(filterPeople([standalone], [])[0], standalone);
});

test("older unmarked people do not bypass an existing role roster", () => {
  const oldEmily = { ...imported, submission_source: "playbill", production_management_person_id: "" };
  assert.equal(filterPeople([oldEmily], [{ person_id: "current-music-director" }]).length, 0);
});

test("production-managed shows require roles even when every role has been removed", () => {
  assert.equal(filterPeople([standalone], [], true).length, 0);
});

test("either PM provenance field identifies an imported contributor", () => {
  const sourceOnly = { ...imported, production_management_person_id: "" };
  const linkOnly = { ...imported, submission_source: "playbill" };
  assert.equal(filterPeople([sourceOnly, linkOnly], []).length, 0);
});

test("assigning the contributor again includes their saved bio", () => {
  assert.equal(filterPeople([imported], []).length, 0);
  assert.equal(filterPeople([imported], [{ person_id: "emily" }])[0].bio, imported.bio);
});
