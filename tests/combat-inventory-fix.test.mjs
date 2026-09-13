import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAmmoStacks } from "../app/inventory-management.ts";
import { requiredAttackD20 } from "../app/osric-combat.ts";
import { startingMoneyFormula } from "../app/osric-character-creation.ts";
import { connectedEngagementClusterIds } from "../app/weapon-combat-rules.ts";

test("required attack roll uses the resolver's natural-roll rules", () => {
  assert.equal(requiredAttackD20({ armorClass: 13, baseModifier: 5 }), 8);
  assert.equal(requiredAttackD20({ armorClass: 30, baseModifier: 0 }), 20);
});

test("multiclass starting money selects one highest-maximum formula", () => {
  assert.deepEqual(startingMoneyFormula("Fighter/Magic-User"), { className:"Fighter", dice:5, sides:4, multiplier:10, maximumGp:200 });
  assert.deepEqual(startingMoneyFormula("Cleric/Magic-User"), { className:"Cleric", dice:3, sides:6, multiplier:10, maximumGp:180 });
  assert.deepEqual(startingMoneyFormula("Thief/Magic-User"), { className:"Thief", dice:2, sides:6, multiplier:10, maximumGp:120 });
});

test("Ammo normalizes only within each container without changing shots", () => {
  const stack = (id, containerId, shotsRemaining) => ({ id, campaignId:"default", name:"Ammo", quantity:1, unitEncumbranceUnits:100, encumbranceClass:"pocket", itemKind:"normal", containerId, locationId:null, placement:null, shotsRemaining });
  const state = { owners:[], containers:[], locations:[], stacks:[stack("a","pack",4), stack("b","pack",6), stack("c","quick",3), stack("d","quick",9)], activity:[], shopping:[] };
  const normalized = normalizeAmmoStacks(state);
  assert.deepEqual(normalized.stacks.filter((entry) => entry.containerId === "pack").map((entry) => entry.shotsRemaining), [10]);
  assert.deepEqual(normalized.stacks.filter((entry) => entry.containerId === "quick").map((entry) => entry.shotsRemaining), [10,2]);
  assert.equal(normalized.stacks.reduce((sum, entry) => sum + entry.shotsRemaining, 0), 22);
});

test("stray-shot engagement traversal exhausts and deduplicates the cluster", () => {
  const engagements = [
    { attackerId:"goblin", defenderId:"fighter", createdRound:1 },
    { attackerId:"fighter", defenderId:"orc", createdRound:1 },
    { attackerId:"orc", defenderId:"cleric", createdRound:1 },
    { attackerId:"cleric", defenderId:"goblin", createdRound:1 },
  ];
  assert.deepEqual(new Set(connectedEngagementClusterIds(engagements, "goblin")), new Set(["goblin","fighter","orc","cleric"]));
});
