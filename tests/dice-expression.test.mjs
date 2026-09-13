import assert from "node:assert/strict";
import test from "node:test";

import { evaluateDiceExpression, looksLikeDice } from "../app/dice-expression.ts";

test("recognizes and evaluates repeated dice expressions in order", () => {
  assert.equal(looksLikeDice("6#3d6"), true);

  const results = evaluateDiceExpression("6#3d6", () => 0);
  assert.equal(results.length, 6);
  assert.deepEqual(results.map((result) => result.label), ["Roll 1", "Roll 2", "Roll 3", "Roll 4", "Roll 5", "Roll 6"]);
  assert.deepEqual(results.map((result) => result.total), [3, 3, 3, 3, 3, 3]);
});

test("recognizes a die after a leading arithmetic modifier", () => {
  assert.equal(looksLikeDice("50+d45"), true);
  assert.equal(evaluateDiceExpression("50+d45", () => 0)[0].total, 51);
  assert.equal(evaluateDiceExpression("d45+50", () => 0)[0].total, 51);
});
