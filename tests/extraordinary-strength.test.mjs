import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { deriveCharacterRecord, qualifiesForExtraordinaryStrength } from "../app/character-rules.ts";
import { getCharacterCapacityUnits, UNITS_PER_STONE } from "../app/inventory-management.ts";
import { derivedAbilityItems, effectiveStrengthScore, strengthEncumbranceStone, strengthScoreLabel } from "../app/osric-stats.ts";

function character(className, strength = "18", patch = {}) {
  return {
    id: "hero", campaignId: "default", name: "Hero", player: "", race: "Human", className, level: 1,
    classLevels: Object.fromEntries(className.replaceAll("→", "/").split("/").map((name) => [name.trim(), 1])),
    movementRate: 120, toHit: 0, armorClass: 10, currentHp: 8, maxHp: 8, hitDice: "1d10",
    currentXp: 0, totalXp: 0, age: "", height: "", weight: "", tileColor: "#ffffff", emoji: "◆",
    stats: [strength, "10", "10", "10", "10", "10"], gold: 0,
    saves: { death: 20, wands: 20, polymorph: 20, breath: 20, spells: 20 }, notes: "",
    diceMacros: [{ name: "", expression: "" }, { name: "", expression: "" }, { name: "", expression: "" }],
    weapons: [], equippedWeaponId: null, handState: "unarmed", inventoryLines: [],
    weaponProficiencies: "", weaponSpecializations: "", weaponTraining: [], spellbook: [], spellSlots: [],
    ...patch,
  };
}

test("Fighter, Paladin, Ranger, and their multiclasses generate one persisted d100 at Strength 18", () => {
  for (const className of ["Fighter", "Paladin", "Ranger", "Fighter/Magic-User", "Fighter → Magic-User"]) {
    assert.equal(qualifiesForExtraordinaryStrength(className, 18), true);
    const generated = deriveCharacterRecord(character(className), { random: () => .72 });
    assert.equal(generated.exceptionalStrength, 73);
    assert.equal(deriveCharacterRecord(generated, { random: () => 0 }).exceptionalStrength, 73);
  }
  assert.equal(deriveCharacterRecord(character("Cleric"), { random: () => .72 }).exceptionalStrength, null);
  assert.equal(deriveCharacterRecord(character("Fighter", "17"), { random: () => .72 }).exceptionalStrength, null);
});

test("00 extraordinary Strength becomes 19 while all other d100 rolls use two decimal digits", () => {
  const hundred = deriveCharacterRecord(character("Fighter"), { random: () => 1 });
  assert.equal(hundred.exceptionalStrength, 100);
  assert.equal(strengthScoreLabel("18", hundred.exceptionalStrength), "19");
  assert.equal(effectiveStrengthScore("18", hundred.exceptionalStrength), 19);
  assert.equal(strengthScoreLabel("18", 1), "18.01");
  assert.equal(strengthScoreLabel("18", 9), "18.09");
  assert.equal(strengthScoreLabel("18", 99), "18.99");
});

test("extraordinary Strength thresholds drive OSRIC hit, damage, tests, and stone capacity", () => {
  const cases = [
    [1, "+1", "+3", "11 st", "1–3 on d6", "20%"],
    [50, "+1", "+3", "11 st", "1–3 on d6", "20%"],
    [51, "+2", "+3", "13 st", "1–4 on d6", "25%"],
    [75, "+2", "+3", "13 st", "1–4 on d6", "25%"],
    [76, "+2", "+4", "15 st", "1–4 on d6", "30%"],
    [90, "+2", "+4", "15 st", "1–4 on d6", "30%"],
    [91, "+2", "+5", "19 st", "1–4 on d6; 1 in 6 extraordinary", "35%"],
    [99, "+2", "+5", "19 st", "1–4 on d6; 1 in 6 extraordinary", "35%"],
    [100, "+3", "+6", "24 st", "1–5 on d6; 2 in 6 extraordinary", "40%"],
  ];
  for (const [roll, hit, damage, encumbrance, minor, major] of cases) {
    const items = Object.fromEntries(derivedAbilityItems(0, "18", roll).map((item) => [item.key, item]));
    assert.equal(items["melee-hit"].value, hit);
    assert.equal(items.damage.value, damage);
    assert.equal(items.encumbrance.value, encumbrance);
    assert.equal(items.minor.value, minor);
    assert.equal(items.major.value, major);
  }
  assert.equal(derivedAbilityItems(0, "18", 91).find((item) => item.key === "minor")?.roll?.extraordinaryTarget, 1);
  assert.equal(derivedAbilityItems(0, "18", 100).find((item) => item.key === "minor")?.roll?.extraordinaryTarget, 2);
});

test("Strength encumbrance is exposed as whole stone and inventory uses the same capacity", () => {
  assert.equal(strengthEncumbranceStone("18"), 9);
  assert.equal(derivedAbilityItems(0, "18").find((item) => item.key === "encumbrance")?.value, "9 st");
  assert.equal(getCharacterCapacityUnits(character("Cleric")), 9 * UNITS_PER_STONE);
  assert.equal(getCharacterCapacityUnits(character("Fighter", "18", { exceptionalStrength: 76 })), 15 * UNITS_PER_STONE);
});

test("sheet, Combat, chat, and inventory consume the persisted extraordinary Strength field", () => {
  const sheet = fs.readFileSync(new URL("../app/character-sheet-panel.tsx", import.meta.url), "utf8");
  const combat = fs.readFileSync(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  const chat = fs.readFileSync(new URL("../app/chat-drawer.tsx", import.meta.url), "utf8");
  const inventory = fs.readFileSync(new URL("../app/inventory-management.ts", import.meta.url), "utf8");
  assert.match(sheet, /strengthScoreLabel\(score, character\.exceptionalStrength\)/);
  assert.match(combat, /derivedAbilityItems\(0, character\.stats\[0\], character\.exceptionalStrength\)/);
  assert.match(chat, /character\.exceptionalStrength/);
  assert.match(inventory, /strengthEncumbranceStone\(character\.stats\[0\], character\.exceptionalStrength\)/);
});
