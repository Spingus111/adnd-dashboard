import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panelSource = await readFile(new URL("../app/character-sheet-panel.tsx", import.meta.url), "utf8");
const toolkitSource = await readFile(new URL("../app/toolkit.tsx", import.meta.url), "utf8");

test("character creation exposes confirmed reversible score, race, and class checkpoints", () => {
  for (const label of ["Lock scores", "Unlock scores", "Lock race", "Unlock race", "Lock class", "Unlock class"]) {
    assert.match(panelSource, new RegExp(`>${label}<`));
  }
  assert.match(panelSource, /window\.confirm\(`Lock these scores\?/);
  assert.match(panelSource, /window\.confirm\("Unlock scores\?/);
  assert.match(panelSource, /window\.confirm\(`Lock \$\{character\.race\}/);
  assert.match(panelSource, /window\.confirm\("Unlock race\?/);
  assert.match(panelSource, /window\.confirm\(`Lock \$\{character\.className\}/);
  assert.match(panelSource, /window\.confirm\("Unlock class selection\?/);
});

test("score editing is enabled by generation permission before race or class selection", () => {
  assert.match(panelSource, /disabled=\{!canEditGeneratedStats \|\| scoresLocked\}/);
  assert.match(panelSource, /if \(!canEditGeneratedStats \|\| scoresLocked/);
  assert.match(panelSource, /scoresLocked && !raceLocked && <button type="button" onClick=\{unlockScores\}/);
});

test("race eligibility and post-class age results are visible in the staged flow", () => {
  assert.match(panelSource, />Available races</);
  assert.match(panelSource, />Unavailable races</);
  assert.match(panelSource, /ancestry\.requirements\.join/);
  assert.match(panelSource, /ageAdjustmentsFor\(character\.race/);
  assert.match(panelSource, />Age adjustments</);
  assert.match(panelSource, />Starting money:/);
});

test("weapons and spells remain unavailable until class lock", () => {
  assert.match(panelSource, /character\.className !== "Unassigned" && character\.statAssignmentComplete !== false && <WeaponsConfig/);
  assert.match(panelSource, /character\.statAssignmentComplete !== false && <div className="character-rules-row">/);
  assert.match(panelSource, /<WeaponTrainingSummary character=\{character\}/);
  assert.match(panelSource, /character\.statAssignmentComplete !== false && <CharacterSpellbook/);
});

test("initial class lock generates once while unlock and relock preserve grants", () => {
  assert.match(toolkitSource, /const completingClass = patch\.statAssignmentComplete === true && character\.statAssignmentComplete === false/);
  assert.match(toolkitSource, /const regeneratePhysical = completingClass && \(!character\.startingInventoryGranted \|\| !character\.height \|\| !character\.weight\)/);
  assert.match(toolkitSource, /const regenerateAge = completingClass && \(!character\.startingInventoryGranted \|\| !character\.age\)/);
  assert.match(panelSource, /Existing starting inventory and age will be preserved/);
});

test("reopening race clears race-dependent physical data before another ancestry is chosen", () => {
  assert.match(panelSource, /raceLocked: false, age: "", height: "", weight: ""/);
  assert.match(toolkitSource, /return deriveCharacterRecord\(character\);/);
});

test("class lock exposes a confirmed final HP roll using the canonical hit dice and Constitution bonus", () => {
  assert.match(panelSource, />Roll hit points</);
  assert.match(panelSource, /"Roll starting HP"/);
  assert.match(panelSource, /constitutionHitPointBonusPerDie\(character\.stats\[2\], character\.className\)/);
  assert.match(panelSource, /rollCharacterHitPoints\(character\.hitDice, character\.stats\[2\], character\.className\)/);
  assert.match(panelSource, /window\.confirm\(`\$\{verb\} starting HP/);
  assert.match(panelSource, /updateCharacter\(\{ currentHp: result\.total, maxHp: result\.total, startingHpRolled: true \}\)/);
});
