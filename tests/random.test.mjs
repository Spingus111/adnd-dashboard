import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { rollSecureDie, secureRandomFloat, secureRandomInteger } from "../app/random.ts";

test("secure random helpers stay inside exact die and index bounds", () => {
  for (let index = 0; index < 2_000; index += 1) {
    const unit = secureRandomFloat();
    const integer = secureRandomInteger(20);
    const die = rollSecureDie(20);
    assert.ok(unit >= 0 && unit < 1);
    assert.ok(integer >= 0 && integer < 20);
    assert.ok(die >= 1 && die <= 20);
  }
});

test("cryptographic d20 rolls cover every face without a gross distribution skew", () => {
  const counts = Array(20).fill(0);
  for (let index = 0; index < 20_000; index += 1) counts[rollSecureDie(20) - 1] += 1;
  assert.equal(counts.every((count) => count > 700 && count < 1_300), true);
});

test("the shared dice surfaces use the secure random source", async () => {
  const files = await Promise.all([
    "dice-panel.tsx", "dice-expression.ts", "chat-drawer.tsx", "segmented-initiative-panel.tsx", "dashboard-panel.tsx",
  ].map((name) => readFile(new URL(`../app/${name}`, import.meta.url), "utf8")));
  assert.match(files[0], /rollSecureDie\(sides\)/);
  assert.match(files[1], /secureRandomFloat/);
  assert.match(files[2], /rollSecureDie\(size\)/);
  assert.match(files[3], /return rollSecureDie\(20\)/);
  assert.match(files[4], /return rollSecureDie\(size\)/);
});
