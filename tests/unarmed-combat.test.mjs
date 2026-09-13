import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  attackerArmorTarget,
  controllingHoldId,
  defenderArmorModifier,
  grappleOutcome,
  grappleResultModifier,
  overbearOutcome,
  overbearResultModifier,
  participantIsGrappling,
  pileOnApplies,
  unarmedDexterityModifier,
  unarmedHitBreakdown,
  unarmedHitSucceeds,
  unarmedMoveModifier,
} from "../app/unarmed-combat.ts";

const blankOverrides = {
  hitTargetNumber: null, hitAttackModifier: null, hitDefenseModifier: null,
  overbearAttackModifier: null, overbearDefenseModifier: null,
  grappleAttackModifier: null, grappleDefenseModifier: null,
  magicArmorBonus: null,
  cannotGrapple: false, cannotBeGrappled: false, cannotOverbear: false,
  cannotBeOverborne: false, immuneTemporaryDamage: false, fourLegged: false, appendages: 2,
};

function participant(patch = {}) {
  return { armorMode: "natural", armorProfile: "flesh", size: "medium", hitDice: "1", unarmedOverrides: blankOverrides, ...patch };
}

test("OSRIC unarmed armour target table and natural-armour house rule", () => {
  const worn = participant({ armorMode: "worn" });
  assert.deepEqual([10,11,12,13,14,15,16,17,18,19,20].map((ac) => attackerArmorTarget(worn, ac)), [2,4,6,8,10,12,14,16,18,20,22]);
  assert.deepEqual(["flesh","hide","scales","plates"].map((armorProfile) => attackerArmorTarget(participant({ armorProfile }))), [2,3,4,6]);
  assert.deepEqual(["flesh","hide","scales","plates"].map((armorProfile) => defenderArmorModifier(participant({ armorProfile }))), [0,0,0,1]);
});

test("movement, DEX, defender armour, overrides, and conditions form the unarmed modifier", () => {
  assert.deepEqual([0,29,30,60,90,120,150,240].map(unarmedMoveModifier), [0,0,2,4,6,8,10,10]);
  assert.deepEqual([14,15,18,19].map(unarmedDexterityModifier), [0,1,1,2]);
  const breakdown = unarmedHitBreakdown({
    attacker: participant({ armorMode: "worn", unarmedOverrides: { ...blankOverrides, hitAttackModifier: 2 } }),
    defender: participant({ armorMode: "worn", unarmedOverrides: { ...blankOverrides, hitDefenseModifier: -1 } }),
    attackerDexterity: 19, attackerMove: 60, defenderMove: 30,
    attackerWornAscendingAc: 15, defenderWornAscendingAc: 17, conditionModifier: 1,
  });
  assert.deepEqual(breakdown, { targetNumber: 12, dexterity: 2, attackerMove: 4, defenderArmor: 5, defenderMove: -2, attackerOverride: 2, defenderOverride: -1, conditions: 1, modifier: 11 });
  assert.equal(unarmedHitSucceeds(1, 2, 100), false);
  assert.equal(unarmedHitSucceeds(2, 22, -20, true), true);
});

test("overbear modifiers use strength or HD, size, four legs, and overrides", () => {
  assert.equal(overbearResultModifier({ attacker: participant({ size: "large", hitDice: "9" }), defender: participant({ size: "small", hitDice: "4" }), attackerFourLegged: true }).total, 7);
  assert.equal(overbearResultModifier({ attacker: participant(), defender: participant(), attackerStrength: "18/76", defenderStrength: 17 }).total, 1);
});

test("grapple modifiers use appendages and opposed size but never strength", () => {
  assert.equal(grappleResultModifier({ attacker: participant({ size: "large" }), defender: participant({ size: "small" }), attackerAppendages: 4, defenderAppendages: 1 }).total, 6);
});

test("overbear outcomes preserve RAW real and temporary damage splits", () => {
  assert.deepEqual([1,2,3,5,7].map((value) => overbearOutcome(value).tier), ["total-failure","partial-failure","partial-success","success","total-success"]);
  assert.deepEqual([overbearOutcome(4).realDamage, overbearOutcome(4).temporaryDamage], [0,4]);
  assert.deepEqual([overbearOutcome(6).realDamage, overbearOutcome(6).temporaryDamage], [1,5]);
  assert.deepEqual([overbearOutcome(9).realDamage, overbearOutcome(9).temporaryDamage, overbearOutcome(9).followUpGrappleBonus], [2,7,2]);
});

test("grapple outcomes preserve holds, damage, and decisive throw cap handoff", () => {
  assert.deepEqual([1,2,5,6,7,8,9].map((value) => grappleOutcome(value).tier), ["scuffling","arm-grab","waist-lock","rear-choke","arm-lock","head-lock","decisive-throw"]);
  assert.deepEqual([grappleOutcome(8).realDamage, grappleOutcome(8).temporaryDamage], [2,6]);
  assert.deepEqual([grappleOutcome(9).realDamage, grappleOutcome(9).temporaryDamage, grappleOutcome(9).repeatsGrappleAtBonus], [3,6,2]);
});

test("relationship holds choose the highest result and preserve the earlier tie", () => {
  const holds = [
    { id:"early", attackerId:"a", defenderId:"b", result:5, establishedOrder:1 },
    { id:"later", attackerId:"b", defenderId:"a", result:5, establishedOrder:2 },
    { id:"other", attackerId:"c", defenderId:"b", result:8, establishedOrder:3 },
  ];
  assert.equal(controllingHoldId(holds, "a", "b"), "early");
  assert.equal(participantIsGrappling(holds, "a"), true);
  assert.equal(participantIsGrappling(holds, "z"), false);
});

test("pile-on requires a different attacker to join an active grapple", () => {
  const hold = { id:"hold", attackerId:"a", defenderId:"b", result:5, establishedOrder:1 };
  assert.equal(pileOnApplies([hold], "c", "b"), true);
  assert.equal(pileOnApplies([hold], "a", "b"), false);
  assert.equal(pileOnApplies([], "c", "b"), false);
  assert.equal(pileOnApplies([{ ...hold, result:1 }], "c", "b"), false);
});

test("foot grabs only make their attacker eligible as a third-party pile-on target", () => {
  const footGrab = { id:"feet", attackerId:"a", defenderId:"b", result:2, establishedOrder:1, footGrab:true };
  assert.equal(pileOnApplies([footGrab], "c", "a"), true);
  assert.equal(pileOnApplies([footGrab], "c", "b"), false);
});

test("Combat exposes the complete contextual unarmed flow without a separate tab", () => {
  const source = fs.readFileSync(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /label: "Unarmed", actions: \["brawl", "grapple", "overbear"\]/);
  assert.match(source, /Fend → Unarmed Hit → d6 Overbear Result/);
  assert.match(source, /Fend → Unarmed Hit → d8 Grapple Result/);
  assert.match(source, /className="unarmed-bottom-sheet"/);
  assert.match(source, /pileOnApplies\(tracker\.grappleHolds, attacker\.id, defender\.id\)/);
  assert.match(source, /temporaryDamage: 0/);
  assert.match(source, /className="unarmed-number-strip"/);
  assert.match(source, /TN \$\{hitBreakdown\.targetNumber\} · NEED \$\{neededRoll\}\+/);
  assert.match(source, /title=\{hitReason\}/);
  assert.match(source, /className="unarmed-number-tile"/);
  assert.match(source, /candidate\.attackMode !== "weapon" \|\| activeWeaponRules\(candidate\)\?\.weaponType === "melee"/);
  assert.match(source, /showTemporaryValue=\{viewerHasGmPermissions\}/);
  assert.match(source, /viewerHasGmPermissions && \(participant\.temporaryDamage/);
  assert.match(source, /temporary damage applied/);
  assert.match(source, /clickEvent\.shiftKey \? adjustParticipantTemporaryDamage\(participant\.id, -1/);
  assert.match(source, /clickEvent\.shiftKey \? adjustParticipantTemporaryDamage\(participant\.id, 1/);
  assert.match(source, /defaultHoldAction = !forcedAction && maintainedHold \? "maintain-hold"/);
  assert.match(source, /targetId: forcedAction \? null : maintainedHold\?\.defenderId/);
  assert.match(source, /grappleHolds: \[\]/);
  assert.match(source, /pendingUnarmed: null/);
  assert.match(source, /"small-weapon": "Short weapon attack"/);
  assert.match(source, /function canGrapple/);
  assert.match(source, /function hasDaggerLengthWeaponInHandOrQuick/);
  assert.match(source, /moveStackToHand\(next, selected\.id, owner\.id, "main", characters\)/);
  assert.match(source, /action !== "small-weapon" \|\| participant\.kind !== "character" \|\| !character \|\| hasDaggerLengthWeaponInHandOrQuick\(character\)/);
});

test("unconscious combatants are grouped with KO'd, dead, and defeated combatants", () => {
  const source = fs.readFileSync(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /const belongsInIncapacitatedGroup/);
  assert.match(source, /participant\.action === "unconscious"/);
  assert.match(source, /effect\.name === "Unconscious"/);
  assert.match(source, /displayedParticipants\.filter\(belongsInIncapacitatedGroup\)/);
});

test("Prone restricts declarations to unarmed combat and supports standing unless Overborne", () => {
  const source = fs.readFileSync(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  const types = fs.readFileSync(new URL("../app/types.ts", import.meta.url), "utf8");
  assert.match(types, /\| "stand-up"/);
  assert.match(source, /const proneAllowedActions = new Set<SegmentedAction>/);
  assert.match(source, /"brawl", "grapple", "overbear", "maintain-hold", "improve-hold", "release-hold", "natural-attack", "stand-up"/);
  assert.match(source, /!participantIsProne \|\| proneAllowedActions\.has\(action\)/);
  assert.match(source, /participantIsOverborne/);
  assert.match(source, /effects\.filter\(\(effect\) => !\(effect\.participantId === participant\.id && effect\.name === "Prone"\)\)/);
  assert.match(source, /Blocked by Overborne/);
});

test("monster and expedition NPC setup expose blank unarmed overrides and capability flags", () => {
  const combat = fs.readFileSync(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  const stable = fs.readFileSync(new URL("../app/npc-stable-panel.tsx", import.meta.url), "utf8");
  for (const source of [combat, stable]) {
    assert.match(source, /Unarmed Hit TN/);
    assert.match(source, /Overbear ATK/);
    assert.match(source, /Grapple DEF/);
    assert.match(source, /Cannot Be Grappled/);
    assert.match(source, /Immune to Temporary Damage/);
  }
});
