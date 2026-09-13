import type { Character, CharacterWeapon, HandState } from "./types";

export const handStateOptions: ReadonlyArray<{ value: HandState; label: string }> = [
  { value: "one-hand-shield", label: "1H melee + shield" },
  { value: "one-hand-light", label: "1H + torch / lantern" },
  { value: "one-hand-missile", label: "1H + javelin / sling" },
  { value: "one-hand-empty", label: "1H + other / empty" },
  { value: "one-hand-offhand", label: "1H + dagger / handaxe" },
  { value: "two-hand-melee", label: "2H melee" },
  { value: "two-hand-ranged", label: "2H ranged" },
  { value: "unarmed", label: "Unarmed · d2 damage" },
];

export function normalizeHandState(value: unknown, equippedCategory?: CharacterWeapon["category"]): HandState {
  if (handStateOptions.some((option) => option.value === value)) return value as HandState;
  if (value === "shield") return "one-hand-shield";
  if (value === "light") return "one-hand-light";
  if (value === "two-handed") return equippedCategory === "ranged" ? "two-hand-ranged" : "two-hand-melee";
  return "one-hand-empty";
}

export function handStateHasShield(value: HandState) {
  return value === "one-hand-shield";
}

export function handStateHasLight(value: HandState) {
  return value === "one-hand-light";
}

export function handStateForWeapon(character: Character, weaponId: string): HandState {
  if (weaponId === "unarmed") return "unarmed";
  const weapon = character.weapons.find((entry) => entry.id === weaponId);
  if (weapon?.category === "ranged") {
    return character.handState === "two-hand-ranged" ? character.handState : "two-hand-ranged";
  }
  if (weapon?.category === "melee") {
    return character.handState === "two-hand-melee" || character.handState.startsWith("one-hand-")
      ? character.handState
      : "one-hand-empty";
  }
  return character.handState === "unarmed" ? "one-hand-empty" : character.handState;
}

export function weaponForHandState(character: Character, handState: HandState) {
  if (handState === "unarmed") return "unarmed";
  if (character.equippedWeaponId && character.equippedWeaponId !== "unarmed") return character.equippedWeaponId;
  const category = handState === "two-hand-ranged" ? "ranged" : "melee";
  return character.weapons.find((weapon) => weapon.name.trim() && weapon.category === category)?.id ?? "unarmed";
}

export function usesUnarmedDamage(character: Character, weaponId?: string | null) {
  return character.handState === "unarmed" || !weaponId || weaponId === "unarmed";
}
