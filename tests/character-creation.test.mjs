import assert from "node:assert/strict";
import test from "node:test";

import {
  ancestryQualifications,
  combinationMinimums,
  finalStatsFromRaw,
  humanDualClassOptions,
  qualifiesForCombination,
  qualifyingCombinations,
  recommendedClassAssignments,
  rollStatPool,
} from "../app/osric-character-creation.ts";

test("race qualification reports unmet requirements after ancestry adjustments", () => {
  const options = ancestryQualifications([7, 10, 10, 10, 10, 10]);
  const human = options.find((entry) => entry.name === "Human");
  const dwarf = options.find((entry) => entry.name === "Dwarf");

  assert.equal(human?.qualified, true);
  assert.equal(dwarf?.qualified, false);
  assert.ok(dwarf?.requirements.includes("STR 8+"));
  assert.ok(dwarf?.requirements.includes("CON 12+"));
});

test("OSRIC race and class minima derive the workbook rows", () => {
  assert.deepEqual(combinationMinimums("Dwarf", "Fighter/Thief"), [9, 9, 12, 6, 6, 6]);
  assert.deepEqual(combinationMinimums("Elf", "Fighter/Magic-User/Thief"), [9, 9, 7, 9, 6, 8]);
  assert.deepEqual(combinationMinimums("Half-Elf", "Cleric/Ranger"), [13, 6, 14, 13, 14, 6]);
});

test("ancestry adjustments are applied before qualification", () => {
  assert.deepEqual(finalStatsFromRaw([9, 16, 8, 15, 6, 6], "Gnome"), [9, 16, 8, 15, 6, 6]);
  assert.deepEqual(finalStatsFromRaw([9, 17, 8, 15, 6, 8], "Elf"), [9, 18, 7, 15, 6, 8]);
  assert.equal(qualifiesForCombination("Elf", "Fighter/Magic-User", [9, 18, 7, 15, 6, 8]), true);
  assert.equal(qualifiesForCombination("Human", "Fighter/Magic-User", [18, 18, 18, 18, 18, 18]), false);
});

test("a generated pool offers clickable legal recommendations", () => {
  const options = recommendedClassAssignments("Human", [13, 17, 14, 11, 11, 14]);
  assert.ok(options.some((entry) => entry.combination === "Fighter"));
  assert.ok(options.some((entry) => entry.combination === "Thief"));
  assert.ok(options.some((entry) => entry.combination === "Magic-User"));
  assert.ok(options.some((entry) => entry.combination === "Paladin"));
  assert.ok(!options.some((entry) => entry.combination === "Illusionist"));
  for (const option of options) assert.equal(qualifiesForCombination("Human", option.combination, option.final), true);
});

test("current final stats produce the legal ancestry class rundown", () => {
  const classes = qualifyingCombinations("Halfling", [9, 17, 14, 11, 11, 14]);
  assert.deepEqual(classes, ["Fighter", "Thief", "Fighter/Thief"]);
});

test("human dual-class options require 15 in old primes and 17 in new primes", () => {
  assert.deepEqual(humanDualClassOptions("Fighter", [15, 12, 12, 17, 10, 10]).map((entry) => entry.to), ["Magic-User"]);
  assert.deepEqual(humanDualClassOptions("Fighter", [14, 18, 18, 18, 18, 18]), []);
});

test("4d6 drop-lowest records all dice and six pool totals", () => {
  const sequence = [0, .2, .4, .99, .1, .3, .5, .7, .2, .4, .6, .8, .3, .5, .7, .9, .4, .6, .8, .99, .5, .7, .9, .99];
  let index = 0;
  const rolled = rollStatPool(() => sequence[index++]);
  assert.equal(rolled.dice.length, 6);
  assert.equal(rolled.totals.length, 6);
  assert.deepEqual(rolled.dice[0], [1, 2, 3, 6]);
  assert.equal(rolled.totals[0], 11);
});
