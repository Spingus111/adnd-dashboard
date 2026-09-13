import type { PsionicAttackMode, PsionicDefenseMode, PsionicsSetup } from "./types.ts";

export const psionicAttackModes: PsionicAttackMode[] = [
  "Psionic Blast",
  "Mind Thrust",
  "Ego Whip",
  "Id Insinuation",
  "Psychic Crush",
];

export const psionicDefenseModes: PsionicDefenseMode[] = [
  "Mind Blank",
  "Thought Shield",
  "Mental Barrier",
  "Intellect Fortress",
  "Tower of Iron Will",
];

function pointValue(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function selectedModes<T extends string>(value: unknown, allowed: readonly T[]) {
  const selected = Array.isArray(value) ? value.filter((entry): entry is T => typeof entry === "string" && allowed.includes(entry as T)) : [];
  return allowed.filter((mode) => selected.includes(mode));
}

/**
 * Psionic combat uses separate attack and defense point pools. Mind Blank is
 * the automatic base defense for every psionic combatant, so persisted data
 * never represents an enabled psionic creature without it.
 */
export function normalizePsionics(value: PsionicsSetup | null | undefined): PsionicsSetup {
  const enabled = Boolean(value?.enabled);
  const maxAttackPoints = pointValue(value?.maxAttackPoints);
  const maxDefensePoints = pointValue(value?.maxDefensePoints);
  const attackModes = selectedModes(value?.attackModes, psionicAttackModes);
  const selectedDefenses = selectedModes(value?.defenseModes, psionicDefenseModes);
  const defenseModes = enabled && !selectedDefenses.includes("Mind Blank")
    ? ["Mind Blank", ...selectedDefenses] as PsionicDefenseMode[]
    : selectedDefenses;
  return {
    enabled,
    maxAttackPoints,
    currentAttackPoints: Math.min(maxAttackPoints, pointValue(value?.currentAttackPoints)),
    maxDefensePoints,
    currentDefensePoints: Math.min(maxDefensePoints, pointValue(value?.currentDefensePoints)),
    attackModes,
    defenseModes,
  };
}
