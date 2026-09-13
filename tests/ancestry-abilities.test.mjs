import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { abilitiesForAncestry } from "../app/ancestry-abilities.ts";

const panelSource = await readFile(new URL("../app/character-sheet-panel.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("ancestry abilities expose only gameplay features in a compact reference", () => {
  assert.deepEqual(abilitiesForAncestry("Halfling").map((entry) => entry.name), ["See in the Dark", "Halfling Marksmanship", "Lightfooted", "Stalwart"]);
  assert.equal(abilitiesForAncestry("Halfling").find((entry) => entry.name === "Halfling Marksmanship")?.description, "+3 to hit with any pulled bow or sling.");
  assert.deepEqual(abilitiesForAncestry("Gnome").find((entry) => entry.name === "Stalwart")?.rows, [["CON 4–6", "+1"], ["CON 7–10", "+2"], ["CON 11–13", "+3"], ["CON 14–17", "+4"], ["CON 18–19", "+5"]]);
  assert.equal(abilitiesForAncestry("Human").length, 0);
});

test("Abilities and Weapons share a two-column row with Weapons on the right", () => {
  assert.match(panelSource, /<div className="character-rules-row"><AncestralAbilitiesPanel[\s\S]*<WeaponTrainingSummary/);
  assert.match(panelSource, /value=\{character\.abilityNotes \?\? ""\}/);
  assert.match(styles, /\.character-rules-row \{[^}]*grid-template-columns: repeat\(2/);
  assert.match(styles, /\.character-rules-row > \.weapon-training-summary \{ grid-column: 2; \}/);
});

test("combat segments have explicit dark surfaces and spellbook helper text has breathing room", () => {
  assert.match(styles, /html\[data-theme="dark"\] \.segment-detail-panel \{[^}]*background: var\(--bg-surface-inset\)/);
  assert.match(styles, /html\[data-theme="dark"\] \.segment-card \{[^}]*background: var\(--bg-surface-inset\)/);
  assert.match(styles, /\.character-spell-panel \.panel-heading p \{[^}]*line-height: 1\.45/);
});
