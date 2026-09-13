import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const toolkit = readFileSync(new URL("../app/toolkit.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("the four rulebooks are restored as dashboard tabs", () => {
  for (const entry of [
    '["player-guide", "Player Guide"]',
    '["gm-guide", "GM Guide"]',
    '["phb", "AD&D PHB"]',
    '["dmg", "AD&D DMG"]',
  ]) assert.match(toolkit, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const pdf of [
    "/osric-player-guide.pdf",
    "/osric-gamemaster-guide.pdf",
    "/add-players-handbook.pdf",
    "/add-dungeon-masters-guide.pdf",
  ]) assert.match(toolkit, new RegExp(pdf.replaceAll("/", "\\/")));
});

test("rulebooks use the native embedded reader instead of a floating utility", () => {
  assert.match(toolkit, /className="pdf-reader-shell"/);
  assert.match(css, /\.pdf-reader-shell\s*\{/);
  assert.doesNotMatch(toolkit, /PersistentPdfReader/);
  assert.doesNotMatch(css, /persistent-pdf-reader|pdf-reader-launcher/);
});
