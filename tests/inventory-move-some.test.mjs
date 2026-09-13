import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const items = readFileSync(new URL("../app/inventory-management-panel.tsx", import.meta.url), "utf8");
const characterInventory = readFileSync(new URL("../app/character-inventory-panel.tsx", import.meta.url), "utf8");

test("Items actions can move a prompted partial stack", () => {
  assert.match(items, /<option value="move-some">Move some…<\/option>/);
  assert.match(items, /window\.prompt\(`Move how many \$\{stack\.name\}\?`/);
  assert.match(items, /moveStack\(state, stackId, \{ type: "ground" \}, campaign\.characters, requestedQuantity\)/);
  assert.match(items, /destinationOptions\(stack, true\)/);
});

test("character inventory can move a prompted partial stack", () => {
  assert.match(characterInventory, /<option value="move-some">Move some…<\/option>/);
  assert.match(characterInventory, /handleMoveSelect\(stack, event\.target\.value\)/);
  assert.match(characterInventory, /requestedQuantity, true/);
});
