import assert from "node:assert/strict";
import test from "node:test";

import { applyManualCombatModifier, parseManualCombatModifier } from "../app/combat-manual-modifier.ts";

test("manual combat modifiers normalize signed numbers and preserve operation order", () => {
  assert.equal(parseManualCombatModifier("5").normalized, "+5");
  assert.equal(parseManualCombatModifier("-2").normalized, "-2");
  assert.equal(parseManualCombatModifier("dd").normalized, "dd");
  assert.equal(parseManualCombatModifier("+5dd").normalized, "+5dd");
  assert.equal(parseManualCombatModifier("dd+5").normalized, "dd+5");
  assert.equal(applyManualCombatModifier(10, "+5dd"), 30);
  assert.equal(applyManualCombatModifier(10, "dd+5"), 25);
  assert.equal(applyManualCombatModifier(10, "-3"), 7);
});

test("invalid manual combat modifiers safely become +0", () => {
  assert.equal(parseManualCombatModifier("nonsense").normalized, "+0");
  assert.equal(applyManualCombatModifier(10, "nonsense"), 10);
});
