import type { Character, CharacterWeapon } from "./types";

export const unarmedWeapon: CharacterWeapon = {
  id: "unarmed",
  name: "Unarmed",
  attackBonus: 0,
  damage: "1d2",
  notes: "Always available.",
  category: "melee",
  specialized: false,
  weaponRulesId: "fist-open-hand",
};

export function availableCharacterWeapons(character: Character) {
  return [unarmedWeapon, ...character.weapons.filter((weapon) => weapon.name.trim())];
}

export function characterWeapon(character: Character, weaponId: string | null | undefined) {
  if (!weaponId || weaponId === unarmedWeapon.id) return unarmedWeapon;
  return character.weapons.find((weapon) => weapon.id === weaponId);
}

export function weaponDamageBonus(expression: string) {
  const compact = expression.replaceAll(" ", "");
  const match = compact.match(/^\d*d(?:\d+|F)((?:[+-]\d+)*)$/i);
  if (!match) return 0;
  return (match[1].match(/[+-]\d+/g) ?? []).reduce((sum, value) => sum + Number(value), 0);
}

export function weaponEquipmentBonus(weapon: Pick<CharacterWeapon, "attackBonus"> | null | undefined) {
  const bonus = Number(weapon?.attackBonus);
  return Number.isFinite(bonus) ? bonus : 0;
}
