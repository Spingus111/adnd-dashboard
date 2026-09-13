import type { SegmentedParticipant } from "./types.ts";
import { ascendingAcToArmorCategory, type ArmorCategory } from "./weapon-rules.ts";

export type MonsterArmorProfile = NonNullable<SegmentedParticipant["armorProfile"]>;

export const naturalArmorProfiles: Array<{ id: MonsterArmorProfile; label: string; armorCategory: ArmorCategory | null }> = [
  { id: "flesh", label: "Flesh · no adjustment", armorCategory: null },
  { id: "hide", label: "Hide · as AC 12", armorCategory: ascendingAcToArmorCategory(12) },
  { id: "scales", label: "Scales · as AC 14", armorCategory: ascendingAcToArmorCategory(14) },
  { id: "plates", label: "Plates · as AC 17", armorCategory: ascendingAcToArmorCategory(17) },
];

const wornBase = [
  { id: "padded", label: "Padded armour", ascendingAc: 12 },
  { id: "leather", label: "Leather armour", ascendingAc: 12 },
  { id: "ring", label: "Ring mail", ascendingAc: 13 },
  { id: "studded", label: "Studded leather", ascendingAc: 13 },
  { id: "scale", label: "Scale armour", ascendingAc: 14 },
  { id: "chain", label: "Chain mail", ascendingAc: 15 },
  { id: "banded", label: "Banded armour", ascendingAc: 16 },
  { id: "splint", label: "Splint armour", ascendingAc: 16 },
  { id: "plate", label: "Plate armour", ascendingAc: 17 },
  { id: "full-plate", label: "Full plate", ascendingAc: 18 },
] as const;

export const wornArmorProfiles: Array<{ id: MonsterArmorProfile; label: string; ascendingAc: number; armorCategory: ArmorCategory }> = wornBase.flatMap((armor) => [
  { id: armor.id as MonsterArmorProfile, label: armor.label, ascendingAc: armor.ascendingAc, armorCategory: ascendingAcToArmorCategory(armor.ascendingAc) },
  { id: `${armor.id}-shield` as MonsterArmorProfile, label: `${armor.label} + shield`, ascendingAc: armor.ascendingAc + 1, armorCategory: ascendingAcToArmorCategory(armor.ascendingAc + 1) },
]);

export function naturalArmorProfile(profile: MonsterArmorProfile | null | undefined) {
  return naturalArmorProfiles.find((entry) => entry.id === profile) ?? naturalArmorProfiles[0];
}

export function wornArmorProfile(profile: MonsterArmorProfile | null | undefined) {
  return wornArmorProfiles.find((entry) => entry.id === profile) ?? null;
}

export function monsterArmorProfileLabel(participant: Pick<SegmentedParticipant, "armorMode" | "armorProfile">) {
  return participant.armorMode === "worn"
    ? wornArmorProfile(participant.armorProfile)?.label ?? "Worn armour"
    : naturalArmorProfile(participant.armorProfile).label;
}

export function defaultMonsterArmorProfile(mode: "natural" | "worn"): MonsterArmorProfile {
  return mode === "worn" ? "padded" : "flesh";
}

export function normalizeMonsterArmorProfile(mode: "natural" | "worn", profile: unknown, ascendingAc: number | null): MonsterArmorProfile {
  if (mode === "natural") return naturalArmorProfiles.some((entry) => entry.id === profile) ? profile as MonsterArmorProfile : "flesh";
  if (wornArmorProfiles.some((entry) => entry.id === profile)) return profile as MonsterArmorProfile;
  const exact = wornArmorProfiles.find((entry) => entry.ascendingAc === ascendingAc && !entry.id.endsWith("-shield"))
    ?? wornArmorProfiles.find((entry) => entry.ascendingAc === ascendingAc);
  return exact?.id ?? "padded";
}
