import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { characterFillStyle, characterTileStyle, contrastRatio } from "../app/tile-color.ts";

const css = await readFile(new URL("../app/design-system.css", import.meta.url), "utf8");
const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

function block(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? "";
}

function tokens(source) {
  return Object.fromEntries(Array.from(source.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi), (match) => [match[1], match[2]]));
}

function luminance(hex) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function expectContrast(theme, foreground, background, minimum, label) {
  const ratio = contrast(theme[foreground], theme[background]);
  assert.ok(ratio >= minimum, `${label}: ${ratio.toFixed(2)} is below ${minimum}:1`);
}

test("canonical light and dark theme pairs meet WCAG AA contrast targets", () => {
  const light = tokens(block(":root"));
  const dark = tokens(block('html[data-theme="dark"]'));
  for (const [name, theme] of [["light", light], ["dark", dark]]) {
    for (const surface of ["bg-page", "bg-surface", "bg-surface-raised", "bg-surface-inset"]) {
      expectContrast(theme, "text-primary", surface, 4.5, `${name} primary ink on ${surface}`);
      expectContrast(theme, "text-secondary", surface, 4.5, `${name} secondary ink on ${surface}`);
      expectContrast(theme, "text-muted", surface, 4.5, `${name} muted ink on ${surface}`);
    }
    expectContrast(theme, "control-border", "bg-surface", 3, `${name} control boundary`);
    expectContrast(theme, "focus-ring", "bg-surface", 3, `${name} focus ring`);
    expectContrast(theme, "disabled-fg", "disabled-bg", 4.5, `${name} disabled control`);
    expectContrast(theme, "danger", "danger-bg", 4.5, `${name} danger notice`);
    expectContrast(theme, "warning", "warning-bg", 4.5, `${name} warning notice`);
    expectContrast(theme, "success", "success-bg", 4.5, `${name} success notice`);
    expectContrast(theme, "info", "info-bg", 4.5, `${name} information notice`);
    expectContrast(theme, "enemy-fg", "enemy-bg", 4.5, `${name} enemy identity`);
    expectContrast(theme, "dead-fg", "dead-bg", 4.5, `${name} dead identity`);
    expectContrast(theme, "action-fg", "gold", 4.5, `${name} primary action`);
    expectContrast(theme, "danger-action-fg", "danger-action", 4.5, `${name} destructive action`);
  }
});

test("legacy dashboard CSS contains no literal colors outside the token system", () => {
  assert.doesNotMatch(globals, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test("interactive text and non-color combat labels remain explicit", () => {
  assert.match(css, /\.character-name-link[\s\S]*?text-decoration-line:\s*underline/);
  assert.match(css, /\.enemy-label\s*\{/);
  assert.match(css, /\.combat-state-label\s*\{/);
});

test("light character-record bands use contrasting text", () => {
  assert.match(globals, /\.osric-character-workspace\s*\{[\s\S]*?--record-ink:\s*var\(--text-primary\);[\s\S]*?--record-band-text:\s*var\(--action-fg\);/);
  assert.match(globals, /\.osric-ability-strip > button > span[^}]*background:\s*var\(--record-ink\)[^}]*color:\s*var\(--record-band-text\)/);
  assert.match(globals, /\.osric-character-card \.character-inventory-panel > summary[^}]*background:\s*var\(--record-ink\)[^}]*color:\s*var\(--record-band-text\)/);
});

test("very bright and very dark character colors receive contrast-safe presentation", () => {
  for (const color of ["#ffffff", "#000000", "#ffff00", "#00103a"]) {
    const style = characterTileStyle(color);
    assert.ok(contrastRatio(style["--character-accent-light"], "#f3ead8") >= 3);
    assert.ok(contrastRatio(style["--character-accent-dark"], "#211b16") >= 3);
    const fill = characterFillStyle(color);
    assert.ok(contrastRatio(fill.color, color) >= 4.5);
  }
});
