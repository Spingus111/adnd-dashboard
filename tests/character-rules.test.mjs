import assert from "node:assert/strict";
import test from "node:test";
import { ageAdjustmentsFor, applyAncestry, applyAncestryAndAge, classNamesFromLine, constitutionHitPointBonusPerDie, deriveCharacterRecord, deriveClassProgression, generatePhysicalRecord, generateStartingAge, rollCharacterHitPoints } from "../app/character-rules.ts";

test("starting HP rolls apply the complete Constitution bonus per hit die", () => {
  assert.equal(constitutionHitPointBonusPerDie(3, "Magic-User"), -2);
  assert.equal(constitutionHitPointBonusPerDie(16, "Cleric"), 2);
  assert.equal(constitutionHitPointBonusPerDie(17, "Magic-User"), 2);
  assert.equal(constitutionHitPointBonusPerDie(17, "Fighter/Magic-User"), 3);
  assert.equal(constitutionHitPointBonusPerDie(18, "Paladin"), 4);
  assert.equal(constitutionHitPointBonusPerDie(19, "Ranger"), 5);

  assert.deepEqual(rollCharacterHitPoints("1d10", 18, "Fighter", () => 0), {
    total: 5, rolls: [1], adjustedRolls: [5], sides: 10, fixedBonus: 0, constitutionBonus: 4,
  });
  assert.equal(rollCharacterHitPoints("2d8", 17, "Ranger", () => 0)?.total, 8);
  assert.equal(rollCharacterHitPoints("1d4", 3, "Magic-User", () => 0)?.total, 1);
  assert.equal(rollCharacterHitPoints("9d10+3", 10, "Fighter", () => 0)?.total, 12);
});

test("OSRIC class progression populates saves, hit dice, XP, and ascending attack bonus", () => {
  assert.deepEqual(deriveClassProgression("Fighter", 1).saves, { wands: 16, breath: 17, death: 14, polymorph: 15, spells: 17 });
  assert.equal(deriveClassProgression("Fighter", 1).toHit, 0);
  assert.equal(deriveClassProgression("Fighter", 5).toHit, 4);
  assert.equal(deriveClassProgression("Fighter", 5).hitDice, "5d10");
  assert.equal(deriveClassProgression("Fighter", 5).totalXp, 35000);
  assert.equal(deriveClassProgression("Fighter", 10).hitDice, "9d10+3");
});

test("arcane and thief matrices convert to the dashboard ascending bonus", () => {
  assert.equal(deriveClassProgression("Magic-User", 1).toHit, -1);
  assert.equal(deriveClassProgression("Magic-User", 11).toHit, 4);
  assert.equal(deriveClassProgression("Magic-User", 16).toHit, 7);
  assert.equal(deriveClassProgression("Magic-User", 21).toHit, 9);
  assert.equal(deriveClassProgression("Thief", 5).toHit, 1);
  assert.equal(deriveClassProgression("Thief", 17).toHit, 8);
  assert.equal(deriveClassProgression("Thief", 21).toHit, 10);
  assert.equal(deriveClassProgression("Fighter", 20).toHit, 16);
});

test("multiclass progression uses best tables, summed next-level XP, and averaged legal dice", () => {
  const fighterMagicUser = deriveClassProgression("Fighter/Magic-User", 1);
  assert.equal(fighterMagicUser.toHit, 0);
  assert.equal(fighterMagicUser.hitDice, "1d6");
  assert.equal(fighterMagicUser.totalXp, 4400);
  assert.deepEqual(fighterMagicUser.saves, { wands: 11, breath: 15, death: 14, polymorph: 13, spells: 12 });

  assert.equal(deriveClassProgression("Thief/Magic-User", 1).hitDice, "1d4");
  assert.equal(deriveClassProgression("Cleric/Magic-User", 2).totalXp, 7800);
});

test("dual-class display lines use the active class progression", () => {
  assert.deepEqual(classNamesFromLine("Fighter → Magic-User"), ["Magic-User"]);
  assert.equal(deriveClassProgression("Fighter → Magic-User", 6).toHit, 1);
});

test("ancestry resilience is applied to the affected saving throw targets", () => {
  assert.deepEqual(deriveClassProgression("Fighter", 1, "Dwarf", 18).saves, { wands: 11, breath: 17, death: 9, polymorph: 15, spells: 12 });
});

test("OSRIC age adjustments are cumulative and stay inside ancestry limits", () => {
  assert.deepEqual(ageAdjustmentsFor("Human", 20), [1, 0, 1, 0, 0, 0]);
  assert.deepEqual(ageAdjustmentsFor("Human", 40), [0, 0, 0, 1, 1, 0]);
  assert.deepEqual(applyAncestryAndAge(["10", "10", "10", "10", "10", "10"], "Human", 20), ["11", "10", "11", "10", "10", "10"]);
  assert.deepEqual(applyAncestryAndAge(["18", "10", "10", "10", "10", "10"], "Human", 20), ["18", "10", "11", "10", "10", "10"]);
});

test("unlocked creation always derives from stable base scores without stale age adjustments", () => {
  const rawStats = ["9", "17", "8", "15", "6", "8"];
  assert.deepEqual(applyAncestry(rawStats, "Elf"), ["9", "18", "7", "15", "6", "8"]);

  const character = {
    id: "creation", campaignId: "default", name: "Creation", player: "", race: "Elf", className: "Unassigned", level: 1,
    movementRate: 120, toHit: 0, armorClass: 10, currentHp: 1, maxHp: 1, hitDice: "1d8", currentXp: 0, totalXp: 0,
    age: "600", height: "5′ 4″", weight: "100 lb", tileColor: "#fff", emoji: "🛡️", stats: ["1", "1", "1", "1", "1", "1"],
    rawStats, statAssignmentComplete: false, gold: 0,
    saves: { death: 20, wands: 20, polymorph: 20, breath: 20, spells: 20 }, notes: "",
    diceMacros: [{ name: "", expression: "" }, { name: "", expression: "" }, { name: "", expression: "" }],
    weapons: [], equippedWeaponId: null, handState: "unarmed", inventoryLines: [], weaponProficiencies: "", weaponSpecializations: "",
    weaponTraining: [], classLevels: {}, spellbook: [], spellSlots: [],
  };
  const elf = deriveCharacterRecord(character);
  const human = deriveCharacterRecord({ ...elf, race: "Human" });
  const elfAgain = deriveCharacterRecord({ ...human, race: "Elf" });

  assert.deepEqual(elf.rawStats, rawStats);
  assert.deepEqual(elf.stats, ["9", "18", "7", "15", "6", "8"]);
  assert.deepEqual(human.stats, rawStats);
  assert.deepEqual(elfAgain.stats, elf.stats);
});

test("race generation supplies book-based age, height, and weight", () => {
  const fixed = () => 0;
  assert.deepEqual(generatePhysicalRecord("Human", "Fighter", fixed), { age: "16", height: "5′ 6″", weight: "145 lb" });
  assert.deepEqual(generatePhysicalRecord("Dwarf", "Cleric", fixed), { age: "252", height: "4′ 2″", weight: "154 lb" });
});

test("class changes regenerate only the race-and-class starting age", () => {
  assert.equal(generateStartingAge("Human", "Fighter", () => 0), "16");
  assert.equal(generateStartingAge("Human", "Magic-User", () => 0), "26");
  const character = {
    id: "age", campaignId: "default", name: "Age", player: "", race: "Human", className: "Magic-User", level: 1,
    movementRate: 120, toHit: 0, armorClass: 10, currentHp: 1, maxHp: 1, hitDice: "1d4", currentXp: 0, totalXp: 0,
    age: "16", height: "5′ 10″", weight: "170 lb", tileColor: "#fff", emoji: "🛡️", stats: ["10", "10", "10", "10", "10", "10"],
    rawStats: ["10", "10", "10", "10", "10", "10"], statAssignmentComplete: true,
    gold: 0, saves: { death: 20, wands: 20, polymorph: 20, breath: 20, spells: 20 }, notes: "",
    diceMacros: [{ name: "", expression: "" }, { name: "", expression: "" }, { name: "", expression: "" }], weapons: [], equippedWeaponId: null,
    handState: "unarmed", inventoryLines: [], weaponProficiencies: "", weaponSpecializations: "", spellbook: [], spellSlots: [],
  };
  const derived = deriveCharacterRecord(character, { regenerateAge: true, random: () => 0 });
  assert.equal(derived.age, "26");
  assert.equal(derived.height, character.height);
  assert.equal(derived.weight, character.weight);
});

test("race generation also applies the OSRIC ancestry movement maximum", () => {
  const base = {
    id: "move", campaignId: "default", name: "Move", player: "", race: "Dwarf", className: "Fighter", level: 1,
    movementRate: 120, toHit: 0, armorClass: 10, currentHp: 1, maxHp: 1, hitDice: "1d10", currentXp: 0, totalXp: 0,
    age: "", height: "", weight: "", tileColor: "#fff", emoji: "🛡️", stats: ["10", "10", "10", "10", "10", "10"],
    gold: 0, saves: { death: 20, wands: 20, polymorph: 20, breath: 20, spells: 20 }, notes: "",
    diceMacros: [{ name: "", expression: "" }, { name: "", expression: "" }, { name: "", expression: "" }], weapons: [], equippedWeaponId: null,
    handState: "unarmed", inventoryLines: [], weaponProficiencies: "", weaponSpecializations: "", spellbook: [], spellSlots: [],
  };
  assert.equal(deriveCharacterRecord(base, { regeneratePhysical: true, random: () => 0.5 }).movementRate, 90);
});

test("character derivation refreshes the complete class record", () => {
  const character = {
    id: "test", campaignId: "default", name: "Test", player: "", race: "Human", className: "Cleric", level: 4,
    movementRate: 120, toHit: 99, armorClass: 10, currentHp: 1, maxHp: 1, hitDice: "wrong", currentXp: 0, totalXp: 0,
    age: "21", height: "5′ 8″", weight: "160 lb", tileColor: "#ffffff", emoji: "🛡️",
    stats: ["10", "10", "10", "10", "10", "10"], rawStats: ["10", "10", "10", "10", "10", "10"], statAssignmentComplete: true,
    gold: 0, saves: { death: 20, wands: 20, polymorph: 20, breath: 20, spells: 20 }, notes: "",
    diceMacros: [{ name: "", expression: "" }, { name: "", expression: "" }, { name: "", expression: "" }],
    weapons: [], equippedWeaponId: null, handState: "unarmed", inventoryLines: [], weaponProficiencies: "", weaponSpecializations: "", spellbook: [], spellSlots: [],
  };
  const derived = deriveCharacterRecord(character);
  assert.equal(derived.toHit, 2);
  assert.equal(derived.hitDice, "4d8");
  assert.equal(derived.totalXp, 13000);
  assert.deepEqual(derived.saves, { wands: 13, breath: 15, death: 9, polymorph: 12, spells: 14 });
});
