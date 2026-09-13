import type { Character } from "./types";

export function preparedSpells(character: Character) {
  return character.spellSlots.flatMap((slot) => {
    if (slot.expended || slot.overCapacity) return [];
    const spell = slot.spellbookId ? character.spellbook.find((entry) => entry.id === slot.spellbookId) : undefined;
    if (spell && (spell.understood === false || spell.level !== slot.level)) return [];
    const name = spell?.name || slot.preparedSpellName?.trim();
    return name ? [{ slotId: slot.id, trackId: slot.trackId, level: slot.level, name, castingTime: spell?.castingTime ?? slot.castingTime ?? slot.level }] : [];
  });
}

export function spellPreparationHours(character: Character) {
  return character.spellSlots.reduce((total, slot) => total + (!slot.overCapacity && (slot.spellbookId || slot.preparedSpellName) ? Math.max(1, slot.level) : 0), 0);
}
