import assert from "node:assert/strict";
import test from "node:test";

import { combatConditionRule, conditionSummary } from "../app/combat-conditions.ts";

function effect(name, remainingRounds = 1) {
  return { id: name, name, target: "Test", participantId: "test", description: "", remainingRounds };
}

test("OSRIC numeric conditions adjust ascending AC, attacks, and saves", () => {
  assert.deepEqual(combatConditionRule([effect("Blinded")]), {
    attack: -4,
    armorClass: -4,
    saves: -4,
    damage: 0,
    disablesShieldAndDexterity: false,
    helpless: false,
    cannotAct: false,
    cannotAttack: false,
  });
  assert.equal(combatConditionRule([effect("Invisible")]).armorClass, 4);
  assert.equal(combatConditionRule([effect("Invisible")]).saves, 4);
  assert.equal(combatConditionRule([effect("Prone")]).armorClass, -4);
  assert.equal(combatConditionRule([effect("Staggered")]).armorClass, -2);
});

test("incapacitating and helpless conditions enforce their action rules", () => {
  const stunned = combatConditionRule([effect("Stunned")]);
  assert.equal(stunned.cannotAct, true);
  assert.equal(stunned.disablesShieldAndDexterity, true);
  assert.equal(stunned.helpless, false);

  for (const name of ["Held / Paralyzed", "Magical Sleep", "Unconscious"]) {
    const rule = combatConditionRule([effect(name)]);
    assert.equal(rule.helpless, true, name);
    assert.equal(rule.cannotAct, true, name);
  }
});

test("condition modifiers stack and expired effects do not apply", () => {
  const rule = combatConditionRule([effect("Bless"), effect("Prayer"), effect("Blinded", 0)]);
  assert.equal(rule.attack, 2);
  assert.equal(rule.damage, 1);
  assert.equal(rule.saves, 1);
  assert.equal(conditionSummary(rule), "+2 THB · +1 saves · +1 damage");
});
