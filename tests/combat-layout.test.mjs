import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("combat declarations default collapsed and keep action, target, timing, and hands compact", async () => {
  const source = await readFile(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");

  assert.match(source, /useState<string\[\]>\(\[\]\)/, "combatants should begin collapsed");
  assert.match(source, />Expand all</);
  assert.match(source, />Collapse all</);
  assert.match(source, /hasSingleTargetControl && <label className="combat-target-field declaration-target-field"/);
  assert.match(source, /className="combat-loadout-strip"/);
  assert.match(source, /availableCharacters\.length > 0 && <div className="mission-add-strip"/);
  assert.doesNotMatch(source, /Every mission character is already added/);
});

test("enemy and expedition NPC combatants retain their distinct side rails", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.segmented-combatant\.kind-enemy\s*\{[\s\S]*?border-left:\s*6px solid var\(--danger-border\) !important/);
  assert.match(styles, /\.segmented-combatant\.kind-npc\s*\{\s*border-left:\s*5px solid var\(--info-border\) !important/);
});
