import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Character inventory treats blocked container ids as a Set", () => {
  const source = readFileSync(new URL("../app/character-inventory-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /!blocked\.has\(entry\.id\)/);
  assert.doesNotMatch(source, /blocked\.includes\(entry\.id\)/);
});

test("Combat does not pass Array.flatMap callback arguments into the roster parameter", () => {
  const source = readFileSync(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /\.flatMap\(\(participant\) => eventsForParticipant\(participant\)\)/);
  assert.doesNotMatch(source, /\.flatMap\(eventsForParticipant\)/);
});

test("Character inventory renders nested containers with local collapse and drag/drop controls", () => {
  const source = readFileSync(new URL("../app/character-inventory-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /function ContainerTree/);
  assert.match(source, /collapsedContainerIds/);
  assert.match(source, /CHARACTER_INVENTORY_DRAG_TYPE/);
  assert.match(source, /onDrop=\{\(event\) => dropItem\(event, `container:/);
  assert.match(source, /onDrop=\{\(event\) => dropItem\(event, "ground"\)\}/);
  assert.match(source, /function HandSlot/);
  assert.match(source, /character-item-grip/);
  assert.match(source, /⚡/);
  assert.match(source, /👕/);
  assert.doesNotMatch(source, /Carried money/);
});
