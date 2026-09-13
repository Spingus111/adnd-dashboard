import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(new URL("../app/dashboard-panel.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("Crawl character headings show compact identity metadata beside the name", () => {
  assert.match(dashboard, /className="crawl-character-meta">\{character\.race\} · \{character\.className\} \{character\.level\} · \{character\.player \|\| "No player"\}/);
  assert.match(css, /\.crawl-character-meta \{[^}]*font-size: 10px;[^}]*white-space: nowrap;/);
  assert.match(css, /\.crawl-character-heading \{[^}]*flex-wrap: wrap;/);
});
