import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  canSpecialize,
  getNonProficiencyPenalty,
  getProficiencyCapacity,
  getSpellcastingTracks,
  getWeaponTrainingState,
  reconcileOsricAutomation,
  specializationCost,
  specializedMissileRate,
  trainingSlotsUsed,
} from "../app/osric-advancement.ts";
import { weaponRulesById } from "../app/weapon-rules.ts";
import { preparedSpells } from "../app/spellcasting.ts";

function character(className, level, wisdom = 10, patch = {}) {
  return {
    id:"hero", campaignId:"default", name:"Hero", player:"", race:"Human", className, level,
    classLevels:Object.fromEntries(className.split("/").map((name) => [name, level])),
    movementRate:120, toHit:0, armorClass:10, currentHp:8, maxHp:8, hitDice:"1d8",
    currentXp:0, totalXp:0, age:"20", height:"", weight:"", tileColor:"#ffffff", emoji:"◆",
    stats:["10","10","10","10",String(wisdom),"10"], gold:0,
    saves:{ death:20,wands:20,polymorph:20,breath:20,spells:20 }, notes:"",
    diceMacros:[{name:"",expression:""},{name:"",expression:""},{name:"",expression:""}],
    weapons:[], equippedWeaponId:null, handState:"unarmed", inventoryLines:[],
    weaponProficiencies:"", weaponSpecializations:"", weaponTraining:[], spellbook:[], spellSlots:[],
    ...patch,
  };
}

function trackSlots(value, tradition) {
  return getSpellcastingTracks(value).find((entry) => entry.tradition === tradition)?.slots ?? [];
}

test("Magic-User starting and historical spellbooks use exact OSRIC counts", () => {
  const first = reconcileOsricAutomation(character("Magic-User", 1));
  assert.deepEqual(trackSlots(first, "arcane"), [1]);
  const book = first.spellbook.filter((entry) => entry.trackId === "magic-user:arcane");
  assert.equal(book.length, 4);
  assert.equal(book.filter((entry) => entry.name === "Read Magic").length, 1);

  const third = reconcileOsricAutomation(character("Magic-User", 3));
  assert.deepEqual(trackSlots(third, "arcane"), [2,1]);
  const historical = third.spellbook.filter((entry) => entry.trackId === "magic-user:arcane");
  assert.equal(historical.length, 6);
  assert.equal(historical.find((entry) => entry.acquisitionClassLevel === 2)?.maximumSpellLevel, 1);
  assert.equal(historical.find((entry) => entry.acquisitionClassLevel === 3)?.maximumSpellLevel, 2);
});

test("Cleric and Druid Wisdom slots are cumulative but never arrive early", () => {
  assert.deepEqual(trackSlots(character("Cleric", 3, 14), "divine"), [4,1]);
  assert.deepEqual(trackSlots(character("Cleric", 3, 18), "divine"), [4,3]);
  assert.deepEqual(trackSlots(character("Druid", 1, 18), "druidic"), [4]);
});

test("Paladin delayed slots and caster-level cap are independent", () => {
  assert.equal(getSpellcastingTracks(character("Paladin", 8, 18)).length, 0);
  const ninth = getSpellcastingTracks(character("Paladin", 9, 18))[0];
  assert.deepEqual(ninth.slots, [1]);
  assert.equal(ninth.casterLevel, 1);
  const twentieth = getSpellcastingTracks(character("Paladin", 20, 18))[0];
  assert.deepEqual(twentieth.slots, [3,3,3,3]);
  assert.equal(twentieth.casterLevel, 8);
  assert.deepEqual(twentieth.wisdomSlots, [0,0,0,0]);
});

test("Ranger tracks appear separately and preserve their delayed spellbook", () => {
  assert.equal(getSpellcastingTracks(character("Ranger", 7)).length, 0);
  assert.deepEqual(getSpellcastingTracks(character("Ranger", 8)).map((entry) => [entry.tradition, entry.slots]), [["druidic",[1]]]);
  const ninth = reconcileOsricAutomation(character("Ranger", 9));
  assert.deepEqual(getSpellcastingTracks(ninth).map((entry) => [entry.tradition, entry.slots]), [["druidic",[1]],["arcane",[1]]]);
  assert.equal(ninth.spellbook.filter((entry) => entry.trackId === "ranger:arcane").length, 4);
  assert.equal(ninth.spellbook.filter((entry) => entry.trackId === "ranger:arcane" && entry.name === "Read Magic").length, 1);
  const twentieth = getSpellcastingTracks(character("Ranger", 20));
  assert.deepEqual(twentieth.map((entry) => [entry.tradition, entry.slots, entry.casterLevel]), [["druidic",[3,3,2],6],["arcane",[3,2],6]]);
});

test("multiclass spell tracks use their own component levels and never merge", () => {
  const multi = character("Cleric/Magic-User", 3, 14, { classLevels:{ Cleric:3, "Magic-User":2 } });
  assert.deepEqual(getSpellcastingTracks(multi).map((entry) => [entry.id, entry.slots]), [["cleric:divine",[4,1]],["magic-user:arcane",[2]]]);
});

test("OSRIC proficiency capacities and specialization total costs are exact", () => {
  assert.equal(getProficiencyCapacity(character("Fighter", 7)), 7);
  assert.equal(getProficiencyCapacity(character("Assassin", 10)), 5);
  assert.equal(getProficiencyCapacity(character("Thief", 10)), 4);
  assert.equal(canSpecialize(character("Fighter", 1)), true);
  assert.equal(canSpecialize(character("Thief", 20)), false);
  assert.deepEqual(Object.fromEntries(["Assassin","Cleric","Druid","Fighter","Illusionist","Magic-User","Monk","Paladin","Ranger","Thief"].map((className) => [className, getNonProficiencyPenalty(character(className, 1))])), {
    Assassin:-3, Cleric:-3, Druid:-4, Fighter:-2, Illusionist:-5, "Magic-User":-5, Monk:-3, Paladin:-2, Ranger:-2, Thief:-3,
  });
  assert.equal(specializationCost(weaponRulesById("long-sword")), 2);
  assert.equal(specializationCost(weaponRulesById("light-crossbow")), 2);
  assert.equal(specializationCost(weaponRulesById("long-bow")), 3);
  assert.equal(trainingSlotsUsed([{ weaponRulesId:"long-sword", proficient:true, specialized:true },{ weaponRulesId:"long-bow", proficient:true, specialized:true }]), 5);
});

test("specialized missile rate checks the actual combat round", () => {
  assert.equal(specializedMissileRate(weaponRulesById("long-bow"), 7, 2), 3);
  assert.equal(specializedMissileRate(weaponRulesById("light-crossbow"), 7, 1), 2);
  assert.equal(specializedMissileRate(weaponRulesById("light-crossbow"), 7, 2), 1);
  assert.equal(specializedMissileRate(weaponRulesById("heavy-crossbow"), 13, 1), 2);
  assert.equal(specializedMissileRate(weaponRulesById("heavy-crossbow"), 13, 2), 1);
  assert.equal(specializedMissileRate(weaponRulesById("heavy-crossbow"), 1, 1), 1);
  assert.equal(specializedMissileRate(weaponRulesById("heavy-crossbow"), 1, 2), 0);
});

test("canonical base IDs carry training across magical weapon variants", () => {
  const hero = character("Fighter", 7, 10, { weaponTraining:[{ weaponRulesId:"long-sword", proficient:true, specialized:true }] });
  assert.deepEqual(getWeaponTrainingState(hero, { name:"Flaming Longsword +2", weaponRulesId:"long-sword" }), { weaponRulesId:"long-sword", proficient:true, specialized:true });
});

test("level loss retains prepared and training records while flagging excess slots", () => {
  const high = reconcileOsricAutomation(character("Magic-User", 3, 10, { weaponTraining:[{ weaponRulesId:"dagger", proficient:true, specialized:false }] }));
  const prepared = { ...high.spellSlots.find((slot) => slot.level === 2), preparedSpellName:"Invisibility" };
  const lowered = reconcileOsricAutomation({ ...high, level:1, classLevels:{ "Magic-User":1 }, spellSlots:high.spellSlots.map((slot) => slot.id === prepared.id ? prepared : slot) });
  assert.equal(lowered.spellbook.length, high.spellbook.length);
  assert.equal(lowered.spellSlots.filter((slot) => slot.overCapacity).length, 2);
  assert.equal(lowered.weaponTraining.length, 1);
});

test("prepared slots stay exact-level and support non-spellbook traditions", () => {
  const cleric = reconcileOsricAutomation(character("Cleric", 1, 10));
  const preparedCleric = { ...cleric, spellSlots:cleric.spellSlots.map((slot, index) => index === 0 ? { ...slot, preparedSpellName:"Bless" } : slot) };
  assert.deepEqual(preparedSpells(preparedCleric).map((spell) => spell.name), ["Bless"]);

  const mage = reconcileOsricAutomation(character("Magic-User", 3));
  const levelOneSpell = mage.spellbook.find((spell) => spell.level === 1 && spell.name);
  const levelTwoSlot = mage.spellSlots.find((slot) => slot.level === 2);
  const mismatched = { ...mage, spellSlots:mage.spellSlots.map((slot) => slot.id === levelTwoSlot.id ? { ...slot, spellbookId:levelOneSpell.id } : slot) };
  assert.equal(preparedSpells(mismatched).some((spell) => spell.slotId === levelTwoSlot.id), false);
});

test("existing UI and Combat consume the centralized automation", () => {
  const sheet = fs.readFileSync(new URL("../app/character-sheet-panel.tsx", import.meta.url), "utf8");
  const combat = fs.readFileSync(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(sheet, /className="weapons-config" open/);
  assert.match(sheet, /getSpellcastingTracks\(character\)/);
  assert.match(sheet, /OVER CAPACITY/);
  assert.match(combat, /getWeaponTrainingState\(character, weapon\)/);
  assert.match(combat, /getNonProficiencyPenalty\(character\)/);
  assert.match(combat, /non-proficiency/);
  assert.match(combat, /specializedMissileRate\(rules, specialistLevel, tracker\.round\)/);
  assert.doesNotMatch(combat, /label: "Special attacks", actions: \["spec-melee"/);
});
