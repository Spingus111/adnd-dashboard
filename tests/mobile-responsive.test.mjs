import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the four play tabs share the responsive viewport and disclosure system", async () => {
  const [layout, css, disclosure, crawl, shopping] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/responsive-disclosure.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/party-panel.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /width: "device-width"/);
  assert.match(css, /@media \(max-width: 768px\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(disclosure, /sessionStorage/);
  assert.match(crawl, /storageKey="crawl-dungeon-time"/);
  assert.match(shopping, /storageKey="shopping-cart"/);
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow-x:\s*hidden/s);
});

test("Items uses a viewport-specific text mode and one-step reorder controls", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/inventory-management-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /isMobileInventory \? mobileTextInventoryOverride \?\? true : desktopTextInventoryMode/);
  assert.match(source, /adnd-desktop-inventory-text-mode/);
  assert.match(source, /moveTextStackWithinList/);
  assert.match(source, /Move \$\{stack\.name\} up/);
  assert.match(source, /Move \$\{stack\.name\} down/);
  assert.match(source, /TEXT_INVENTORY_COLUMN_BREAK/);
  assert.match(source, /targetColumn\?: 0 \| 1/);
  assert.match(source, /either column may hold any number/);
  assert.match(css, /\.mobile-reorder-controls/);
});

test("Combat confines horizontal scrolling to its segment timeline", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /className="combat-timeline-scroll"/);
  assert.match(css, /\.combat-timeline-scroll\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.combat-timeline-scroll \.segment-track/);
});
