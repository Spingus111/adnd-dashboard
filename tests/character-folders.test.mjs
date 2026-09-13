import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { characterFolderStartsOpen } from "../app/character-folders.ts";

test("folders start collapsed when a player has no character in them", () => {
  assert.equal(characterFolderStartsOpen("party-member", ["alice"], ["alice", "borin"]), true);
  assert.equal(characterFolderStartsOpen("party-member", ["alice"], ["borin"]), false);
  assert.equal(characterFolderStartsOpen("party-member", ["alice"], []), false);
  assert.equal(characterFolderStartsOpen(null, [], ["borin"]), false);
});

test("GM and Solo folders start open only when populated", () => {
  assert.equal(characterFolderStartsOpen("gm", [], ["borin"]), true);
  assert.equal(characterFolderStartsOpen("solo", [], ["borin"]), true);
  assert.equal(characterFolderStartsOpen("gm", [], []), false);
});

test("Characters exposes configurable colored folders and concise activity labels", async () => {
  const source = await readFile(new URL("../app/character-sheet-panel.tsx", import.meta.url), "utf8");
  assert.match(source, />\+ Folder<\/button>/);
  assert.match(source, /aria-label="Folder name"/);
  assert.match(source, /type="color"/);
  assert.match(source, /Move \$\{character\.name\} to folder/);
  assert.match(source, /\{onMission \? "Active" : "Standby"\}/);
  assert.doesNotMatch(source, /\{onMission \? "On mission" : "In stable"\}/);
});
