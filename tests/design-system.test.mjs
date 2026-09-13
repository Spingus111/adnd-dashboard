import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredTokens = [
  "--font-ui",
  "--text-xl",
  "--text-lg",
  "--text-md",
  "--text-sm",
  "--text-xs",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--bg-page",
  "--bg-surface",
  "--bg-surface-raised",
  "--border-subtle",
  "--gold",
  "--gold-hover",
  "--gold-active",
  "--success",
  "--warning",
  "--danger",
];

test("the global design system owns the shared theme and typography tokens", async () => {
  const [designSystem, layout] = await Promise.all([
    readFile(new URL("../app/design-system.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  for (const token of requiredTokens) {
    assert.match(designSystem, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`));
  }
  assert.match(designSystem, /"Courier Prime", "Courier New", Courier, monospace/);
  assert.match(designSystem, /\.tabs button\[class\*="tab-"\]\.active/);
  assert.ok(
    layout.indexOf('import "./design-system.css"') > layout.indexOf('import "./globals.css"'),
    "design-system.css must load after feature geometry",
  );
});

test("disclosures share one caret and explicit toggle language", async () => {
  const [css, combat, characters] = await Promise.all([
    readFile(new URL("../app/design-system.css", import.meta.url), "utf8"),
    readFile(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/character-sheet-panel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /details > summary::before/);
  assert.match(css, /details\[open\] > summary::before/);
  assert.match(css, /details > summary::after \{[\s\S]*content: "Expand"/);
  assert.match(css, /details\[open\] > summary::after \{ content: "Collapse"; \}/);
  assert.match(css, /\.inventory-management-shell details[\s\S]*summary::after \{ content: none !important; \}/);
  assert.match(css, /\.character-expand-button, \.combatant-collapse-toggle, \.collapse-button/);
  assert.match(css, /\.text-card-toggle, \.text-tree-toggle/);
  assert.match(combat, /combatant-header clickable-card-header/);
  assert.match(combat, /combatant-name-toggle/);
  assert.match(characters, /osric-sheet-header clickable-card-header/);
});

test("player character surfaces retain their color on the left edge", async () => {
  const [css, combat, characterSheet] = await Promise.all([
    readFile(new URL("../app/design-system.css", import.meta.url), "utf8"),
    readFile(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/character-sheet-panel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /\.segmented-combatant\.player-combatant/);
  assert.match(css, /\.text-inventory-card\.character/);
  assert.match(css, /border-left-color: var\(--character-accent/);
  assert.match(combat, /character \? "player-combatant"/);
  assert.match(characterSheet, /style=\{characterTileStyle\(character\.tileColor\)\}/);
});

test("item tiles retain semantic treasure, weapon, and wearable colors", async () => {
  const [css, inventory] = await Promise.all([
    readFile(new URL("../app/design-system.css", import.meta.url), "utf8"),
    readFile(new URL("../app/inventory-management-panel.tsx", import.meta.url), "utf8"),
  ]);
  for (const tone of ["treasure", "weapon", "wearable"]) {
    assert.match(css, new RegExp(`\\.${tone} \\{`));
  }
  assert.match(inventory, /const tileTone = stack\.itemKind === "treasure"/);
  assert.match(inventory, /stack\.equipment\?\.kind === "weapon" \? "weapon"/);
});
