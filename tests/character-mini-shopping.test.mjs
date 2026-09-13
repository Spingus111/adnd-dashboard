import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inventory = await readFile(new URL("../app/character-inventory-panel.tsx", import.meta.url), "utf8");
const characters = await readFile(new URL("../app/character-sheet-panel.tsx", import.meta.url), "utf8");

test("character Mini Shopping is a collapsed disclosure using the shared language", () => {
  assert.match(inventory, /<details className="character-mini-shop">/);
  assert.match(inventory, /<summary><span>Mini shopping<\/span><small>Catalog equipment and containers only<\/small><\/summary>/);
  assert.doesNotMatch(inventory, /<details className="character-mini-shop" open/);
  assert.match(characters, /\{expanded \? "Collapse" : "Expand"\}/);
  assert.doesNotMatch(characters, /\{expanded \? "Collapse" : "Open sheet"\}/);
});

test("character sheets expose GM AC editing and compact container capacity bars", () => {
  assert.match(characters, /armorClassOverride: armorClass/);
  assert.match(characters, /Use equipment/);
  assert.match(inventory, /character-container-capacity/);
  assert.match(inventory, /role="progressbar"/);
  assert.match(inventory, /capacityRatio >= 0\.75 \? "warning"/);
  assert.match(inventory, /equipmentDisplayName\(item\.name\)/);
});
