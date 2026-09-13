import assert from "node:assert/strict";
import test from "node:test";

import { availableCharacterWeapons, characterWeapon, weaponDamageBonus, weaponEquipmentBonus } from "../app/character-weapons.ts";
import { evaluateHpEntry } from "../app/hp-math.ts";
import { visibleMarchCapacity } from "../app/marching-order.ts";
import { handStateHasLight, handStateHasShield, handStateOptions, normalizeHandState, usesUnarmedDamage, weaponForHandState } from "../app/hand-states.ts";

const character = {
  handState: "one-hand-empty",
  equippedWeaponId: "sword",
  weapons: [{ id: "sword", name: "Sword", attackBonus: 1, damage: "1d8", notes: "", category: "melee", specialized: false }],
};

test("unarmed is the always-available default melee weapon", () => {
  assert.equal(characterWeapon(character, null)?.name, "Unarmed");
  assert.equal(characterWeapon(character, null)?.damage, "1d2");
  assert.equal(characterWeapon(character, null)?.category, "melee");
  assert.deepEqual(availableCharacterWeapons(character).map((weapon) => weapon.name), ["Unarmed", "Sword"]);
});

test("hand loadouts expose the eight requested configurations and migrate old saves", () => {
  assert.deepEqual(handStateOptions.map((option) => option.label), [
    "1H melee + shield",
    "1H + torch / lantern",
    "1H + javelin / sling",
    "1H + other / empty",
    "1H + dagger / handaxe",
    "2H melee",
    "2H ranged",
    "Unarmed · d2 damage",
  ]);
  assert.equal(normalizeHandState("shield"), "one-hand-shield");
  assert.equal(normalizeHandState("light"), "one-hand-light");
  assert.equal(normalizeHandState("two-handed", "ranged"), "two-hand-ranged");
  assert.equal(normalizeHandState("free"), "one-hand-empty");
  assert.equal(handStateHasShield("one-hand-shield"), true);
  assert.equal(handStateHasLight("one-hand-light"), true);
});

test("unarmed loadout forces the always-available d2 weapon", () => {
  assert.equal(weaponForHandState(character, "unarmed"), "unarmed");
  assert.equal(usesUnarmedDamage({ ...character, handState: "unarmed" }, "sword"), true);
  assert.equal(usesUnarmedDamage(character, "sword"), false);
});

test("extracts flat weapon damage for the hit-die damage house rule", () => {
  assert.equal(weaponDamageBonus("1d8+1"), 1);
  assert.equal(weaponDamageBonus("2d4-1"), -1);
  assert.equal(weaponDamageBonus("d6+2-1"), 1);
  assert.equal(weaponDamageBonus("1d10"), 0);
});

test("a custom equipment bonus applies to both attack and damage", () => {
  assert.equal(weaponEquipmentBonus(character.weapons[0]), 1);
  assert.equal(weaponEquipmentBonus({ attackBonus: -2 }), -2);
  assert.equal(weaponEquipmentBonus(undefined), 0);
});

test("HP entries support relative math, direct values, and blank zero", () => {
  assert.equal(evaluateHpEntry("-3", 48), 45);
  assert.equal(evaluateHpEntry("+13", 45), 58);
  assert.equal(evaluateHpEntry("22", 48), 22);
  assert.equal(evaluateHpEntry("", 48), 0);
  assert.equal(evaluateHpEntry("=-3", 48), -3);
});

test("a full marching formation exposes one additional empty row", () => {
  const dashboard = { marchColumns: 2, marchingOrderIds: [], marchingOrderSlots: Array.from({ length: 25 }, (_, index) => index < 10 ? `pc-${index}` : null) };
  assert.equal(visibleMarchCapacity(dashboard), 12);

  dashboard.marchColumns = 5;
  dashboard.marchingOrderSlots = Array.from({ length: 25 }, (_, index) => `pc-${index}`);
  assert.equal(visibleMarchCapacity(dashboard), 30);
});
