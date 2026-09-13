import assert from "node:assert/strict";
import test from "node:test";

import { armorMovementCapForName, dailyHexes, effectiveArmorMovementRate, encumbranceLoadPercent, encumbranceSummary, movementSummary, partyEncumbranceSurpriseModifier } from "../app/movement.ts";

test("movement rate converts to cautious/combat 6-mile hexes per day", () => {
  assert.equal(dailyHexes(90), 3);
  assert.equal(dailyHexes(60), 2);
  assert.equal(dailyHexes(120), 4);
  assert.deepEqual(movementSummary(90), { rate: 90, hexes: 3 });
});

test("worn armour applies the OSRIC movement caps without shield penalties", () => {
  assert.equal(armorMovementCapForName("Leather armor"), 120);
  assert.equal(armorMovementCapForName("Chain mail"), 90);
  assert.equal(armorMovementCapForName("Studded leather"), 90);
  assert.equal(armorMovementCapForName("Elfin chain mail"), 120);
  assert.equal(armorMovementCapForName("Plate mail"), 60);
  assert.equal(armorMovementCapForName("Large shield"), null);
  const campaign = {
    inventoryManagement: {
      owners: [{ id: "owner", type: "character", characterId: "hero" }],
      containers: [{ id: "worn", containerType: "worn", holderType: "owner", holderId: "owner" }],
      stacks: [
        { id: "plate", name: "Plate armor", containerId: "worn", equipment: { kind: "armor" } },
        { id: "shield", name: "Large shield", containerId: "worn", equipment: { kind: "shield" } },
      ],
    },
  };
  assert.equal(effectiveArmorMovementRate(campaign, { id: "hero", movementRate: 120 }), 60);
  assert.equal(dailyHexes(effectiveArmorMovementRate(campaign, { id: "hero", movementRate: 120 })), 2);
});

test("encumbrance uses generous stone bands and a majority-only surprise adjustment", () => {
  assert.equal(encumbranceSummary(90, 4000, 4000).rate, 90);
  assert.equal(encumbranceSummary(90, 5200, 4000).rate, 70);
  assert.equal(encumbranceSummary(90, 6400, 4000).rate, 50);
  assert.equal(encumbranceSummary(90, 7600, 4000).rate, 20);
  assert.equal(encumbranceSummary(90, 7601, 4000).rate, 0);
  assert.equal(encumbranceLoadPercent(0, 4000), 0);
  assert.equal(encumbranceLoadPercent(7600, 4000), 100);
  assert.equal(encumbranceLoadPercent(9000, 4000), 100);
  assert.equal(partyEncumbranceSurpriseModifier([
    encumbranceSummary(90, 4000, 4000),
    encumbranceSummary(90, 4000, 4000),
    encumbranceSummary(90, 7600, 4000),
  ]), 1);
  assert.equal(partyEncumbranceSurpriseModifier([
    encumbranceSummary(90, 7600, 4000),
    encumbranceSummary(90, 7600, 4000),
    encumbranceSummary(90, 4000, 4000),
  ]), -1);
});
