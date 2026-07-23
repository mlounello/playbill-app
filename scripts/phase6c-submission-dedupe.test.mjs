import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const submissions = await readFile(
  new URL("../lib/submissions.ts", import.meta.url),
  "utf8"
);

test("People & Roles chooses the newest request status per person and submission type", () => {
  assert.match(submissions, /latestRequestByPersonAndType/);
  assert.match(submissions, /createdAt >= currentRequest\.createdAt/);
});

test("the Submissions queue emits only the newest bio task for a person", () => {
  assert.match(submissions, /newestRequestsFirst/);
  assert.match(submissions, /requestType === "bio"[\s\S]*?`\$\{personId\}\|bio`/);
});
