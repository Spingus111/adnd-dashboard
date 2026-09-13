import type { CSSProperties } from "react";

type Rgb = [number, number, number];

const LIGHT_PARCHMENT = "#f3ead8";
const DARK_PARCHMENT = "#211b16";
const LIGHT_INK = "#241f18";
const DARK_INK = "#fff8e8";

function parseHexColor(color: string): Rgb | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const value = match[1].length === 3
    ? match[1].split("").map((part) => part + part).join("")
    : match[1];
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)) as Rgb;
}

function channelLuminance(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: Rgb) {
  return 0.2126 * channelLuminance(color[0])
    + 0.7152 * channelLuminance(color[1])
    + 0.0722 * channelLuminance(color[2]);
}

export function contrastRatio(first: string, second: string) {
  const firstRgb = parseHexColor(first);
  const secondRgb = parseHexColor(second);
  if (!firstRgb || !secondRgb) return 1;
  const firstLuminance = relativeLuminance(firstRgb);
  const secondLuminance = relativeLuminance(secondRgb);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function rgbToHex(color: Rgb) {
  return `#${color.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function mix(first: Rgb, second: Rgb, amount: number): Rgb {
  return first.map((channel, index) => channel + (second[index] - channel) * amount) as Rgb;
}

function contrastSafeAccent(color: string, surface: string, destination: string) {
  const source = parseHexColor(color) ?? parseHexColor("#708878")!;
  const target = parseHexColor(destination)!;
  let candidate = rgbToHex(source);
  for (let step = 0; step <= 20 && contrastRatio(candidate, surface) < 3; step += 1) {
    candidate = rgbToHex(mix(source, target, (step + 1) / 20));
  }
  return candidate;
}

export function readableTextColor(color: string) {
  if (!parseHexColor(color)) return LIGHT_INK;
  return contrastRatio(DARK_INK, color) >= 4.5 ? DARK_INK : LIGHT_INK;
}

export function characterTileStyle(color: string) {
  return {
    "--character-color": color,
    "--character-accent-light": contrastSafeAccent(color, LIGHT_PARCHMENT, LIGHT_INK),
    "--character-accent-dark": contrastSafeAccent(color, DARK_PARCHMENT, DARK_INK),
    "--tile-foreground": "var(--text-primary)",
    "--tile-name-color": "var(--text-primary)",
  } as CSSProperties;
}

export function characterFillStyle(color: string) {
  const foreground = readableTextColor(color);
  return {
    backgroundColor: color,
    color: foreground,
    "--tile-foreground": foreground,
  } as CSSProperties;
}
