import assert from "node:assert/strict";
import test from "node:test";

import { adjustedSurpriseSegments, attackHitsAscendingArmor, attackRequiresDeclaredTarget, canCheckUnhelmedHeadshot, canChooseNonIntelligentSaveTable, heroicAssaultEligible, maximumHitPointsFromHitDice, missileInitiativeAdjustment, missileInitiativeSegment, monsterAttackBonus, monsterOnslaughtSegment, resolvedAttackD20, specializedMeleeRate, specializedMeleeSegments, surpriseSegmentsForRoll } from "../app/osric-combat.ts";

test("uses the OSRIC monster BTHB bands exactly and caps 16+ HD at +13", () => {
  assert.deepEqual([
    monsterAttackBonus("1-2"), monsterAttackBonus("1-1"), monsterAttackBonus("1"), monsterAttackBonus("1+1"),
    monsterAttackBonus("2"), monsterAttackBonus("3+3"), monsterAttackBonus("4"), monsterAttackBonus("6"),
    monsterAttackBonus("8+4"), monsterAttackBonus("10"), monsterAttackBonus("12"), monsterAttackBonus("14"),
    monsterAttackBonus("16"), monsterAttackBonus("30+10"),
  ], [-1, 0, 1, 2, 4, 4, 5, 7, 8, 10, 11, 12, 13, 13]);
});

test("Heroic Assault only accepts HD expressions whose maximum possible hp is below 8", () => {
  assert.equal(maximumHitPointsFromHitDice("1d6+1"), 7);
  assert.equal(heroicAssaultEligible("1d6+1"), true);
  assert.equal(heroicAssaultEligible("1-1"), true);
  assert.equal(heroicAssaultEligible("1d8"), false);
  assert.equal(heroicAssaultEligible("2d4"), false);
});

test("specialized melee attack rates and odd-even schedules match OSRIC", () => {
  assert.equal(specializedMeleeRate(1), "3/2");
  assert.deepEqual(specializedMeleeSegments(1, 1, 4), [1, 10]);
  assert.deepEqual(specializedMeleeSegments(1, 2, 4), [4]);
  assert.equal(specializedMeleeRate(7), "2/1");
  assert.deepEqual(specializedMeleeSegments(7, 2, 4), [1, 10]);
  assert.equal(specializedMeleeRate(13), "5/2");
  assert.deepEqual(specializedMeleeSegments(13, 1, 4), [1, 5, 10]);
  assert.deepEqual(specializedMeleeSegments(13, 2, 4), [1, 10]);
});

test("non-intelligent save selection is limited to a combatant's entry round", () => {
  assert.equal(canChooseNonIntelligentSaveTable(1, 1, "declaration"), true);
  assert.equal(canChooseNonIntelligentSaveTable(3, 3, "declaration"), true);
  assert.equal(canChooseNonIntelligentSaveTable(4, 3, "declaration"), false);
  assert.equal(canChooseNonIntelligentSaveTable(3, 3, "active"), false);
});

test("ranged attacks can be declared without choosing a target", () => {
  assert.equal(attackRequiresDeclaredTarget("missile"), false);
  assert.equal(attackRequiresDeclaredTarget("spec-ranged"), false);
  assert.equal(attackRequiresDeclaredTarget("close-hurl"), false);
  assert.equal(attackRequiresDeclaredTarget("melee"), true);
});

test("Monster Onslaught preserves fixed bookend attacks and independent rolled segments", () => {
  assert.equal(monsterOnslaughtSegment("segment-1", null), 1);
  assert.equal(monsterOnslaughtSegment("rolled", 4), 4);
  assert.equal(monsterOnslaughtSegment("rolled", 12), 10);
  assert.equal(monsterOnslaughtSegment("segment-10", null), 10);
});

test("surprise rolls use their result as duration and Dexterity only adjusts actual surprise", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((roll) => surpriseSegmentsForRoll(roll)), [1, 2, 0, 0, 0, 0]);
  assert.equal(surpriseSegmentsForRoll(3, 3), 3);
  assert.equal(surpriseSegmentsForRoll(6, 6), 6);
  assert.equal(adjustedSurpriseSegments(2, 2), 0);
  assert.equal(adjustedSurpriseSegments(2, -1), 3);
  assert.equal(adjustedSurpriseSegments(0, -3), 0);
});

test("Dexterity moves missile initiative earlier or later and clamps the segment", () => {
  assert.equal(missileInitiativeAdjustment(18), -3);
  assert.equal(missileInitiativeSegment(5, 18), 2);
  assert.equal(missileInitiativeAdjustment(3), 3);
  assert.equal(missileInitiativeSegment(5, 3), 8);
  assert.equal(missileInitiativeSegment(1, 18), 1);
  assert.equal(missileInitiativeSegment(6, 3), 9);
});

test("unhelmed enemy headshots only follow qualifying 10+ misses against armor", () => {
  assert.equal(canCheckUnhelmedHeadshot({ targetIsEnemy: true, armoredHead: false, ascendingArmorClass: 15, attackRoll: 10, ordinaryHit: false, automaticHit: false }), true);
  assert.equal(canCheckUnhelmedHeadshot({ targetIsEnemy: true, armoredHead: true, ascendingArmorClass: 15, attackRoll: 10, ordinaryHit: false, automaticHit: false }), false);
  assert.equal(canCheckUnhelmedHeadshot({ targetIsEnemy: true, armoredHead: false, ascendingArmorClass: 10, attackRoll: 10, ordinaryHit: false, automaticHit: false }), false);
  assert.equal(canCheckUnhelmedHeadshot({ targetIsEnemy: true, armoredHead: false, ascendingArmorClass: 15, attackRoll: 9, ordinaryHit: false, automaticHit: false }), false);
  assert.equal(canCheckUnhelmedHeadshot({ targetIsEnemy: true, armoredHead: false, ascendingArmorClass: 15, attackRoll: 10, ordinaryHit: true, automaticHit: false }), false);
});

test("natural twenty adds five to attack resolution and natural one always fails", () => {
  assert.equal(resolvedAttackD20(20), 25);
  assert.equal(attackHitsAscendingArmor({ roll: 20, attackModifier: 0, armorClass: 25 }), true);
  assert.equal(attackHitsAscendingArmor({ roll: 1, attackModifier: 99, armorClass: 10 }), false);
});
