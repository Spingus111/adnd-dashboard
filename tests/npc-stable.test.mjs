import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  addStableNpcInventory,
  createStableNpc,
  nextStableNpcNumber,
  stableNpcInventoryOwner,
  stableNpcToParticipant,
} from "../app/npc-stable.ts";
import { UNITS_PER_STONE } from "../app/inventory-management.ts";

const emptyInventory = () => ({ owners: [], locations: [], containers: [], stacks: [], layoutPositions: {}, activityLog: [], sellVisible: true, shoppingCart: [], discarded: [] });

test("bulk troop creation produces persistent numbered records with canonical equipment ids", () => {
  const troops = Array.from({ length: 6 }, (_, index) => createStableNpc("default", "heavy-foot", null, index + 1));
  const sergeant = createStableNpc("default", "sergeant", null, 1);
  assert.deepEqual(troops.map((npc) => npc.token), ["H1", "H2", "H3", "H4", "H5", "H6"]);
  assert.ok(troops.every((npc) => npc.maxHp >= 1 && npc.maxHp <= 6));
  assert.deepEqual(troops[0].weaponRulesIds, ["halberd", "short-sword"]);
  assert.equal(troops[0].armorProfile, "scale");
  assert.equal(sergeant.hitDice, "1d10");
  assert.ok(sergeant.maxHp >= 1 && sergeant.maxHp <= 10);
  assert.equal(nextStableNpcNumber([...troops, sergeant], "default", "heavy-foot"), 7);
});

test("porter, mule, horse, and ox reuse their stable id as an Items owner with movable Bags", () => {
  const examples = [
    ["porter", null, 10],
    ["mule", null, 20],
    ["horse", "draft", 30],
    ["ox", null, 40],
  ];
  for (const [templateId, subtypeId, stone] of examples) {
    const npc = createStableNpc("default", templateId, subtypeId, 1);
    const owner = stableNpcInventoryOwner(npc);
    assert.equal(owner?.id, npc.id);
    assert.equal(owner?.capacityUnits, stone * UNITS_PER_STONE);
    const inventory = addStableNpcInventory(emptyInventory(), npc);
    assert.equal(inventory.owners[0].id, npc.id);
    assert.deepEqual(inventory.containers.map((container) => [container.name, container.holderId, container.capacityUnits, container.movable]), [[`${npc.name}'s Bags`, npc.id, stone * UNITS_PER_STONE, true]]);
  }
});

test("animal templates retain the OSRIC combat profiles and dogs never become inventory owners", () => {
  const mule = createStableNpc("default", "mule", null, 1);
  assert.deepEqual([mule.size, mule.armorClass, mule.hitDice, mule.movementRate, mule.damageExpression, mule.onslaughtDamage], ["large", 13, "3", 120, "1d2", ["1d6", "1d6"]]);
  const warDog = createStableNpc("default", "dog", "war", 1);
  assert.deepEqual([warDog.size, warDog.armorClass, warDog.hitDice, warDog.movementRate, warDog.damageExpression, warDog.moraleImmune], ["medium", 14, "2+2", 120, "2d4", true]);
  assert.equal(stableNpcInventoryOwner(warDog), null);
  const ox = createStableNpc("default", "ox", null, 1);
  assert.equal(ox.noncombatant, true);
  assert.equal(ox.damageExpression, "");
});

test("Marching Order, Items, and Combat reference one Stable NPC id", () => {
  const mule = createStableNpc("default", "mule", null, 2);
  const owner = stableNpcInventoryOwner(mule);
  const combatant = stableNpcToParticipant(mule, 3);
  assert.equal(owner?.id, mule.id);
  assert.equal(combatant.id, mule.id);
  assert.equal(combatant.stableNpcId, mule.id);
  assert.equal(combatant.side, "party");
  assert.equal(combatant.large, true);
});

test("Expeditions owns the Stable while Crawl only consumes expedition NPCs", () => {
  const crawl = readFileSync(new URL("../app/dashboard-panel.tsx", import.meta.url), "utf8");
  const toolkit = readFileSync(new URL("../app/toolkit.tsx", import.meta.url), "utf8");
  const expeditions = readFileSync(new URL("../app/expeditions-panel.tsx", import.meta.url), "utf8");
  const stable = readFileSync(new URL("../app/npc-stable-panel.tsx", import.meta.url), "utf8");
  const combat = readFileSync(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(crawl, /<NpcStablePanel/);
  assert.match(crawl, /Current expedition/);
  assert.match(expeditions, /<NpcStablePanel/);
  assert.match(expeditions, /placeNpcInMarch/);
  assert.match(toolkit, /\["expeditions", "Expeditions"\],[\s\S]*\["travel", "Travel"\]/);
  assert.match(stable, /npc-stable-standalone/);
  assert.match(combat, /Expedition NPCs/);
  assert.match(combat, /stableNpcToParticipant/);
});
