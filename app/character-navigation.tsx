"use client";

import type { ReactNode } from "react";

export const CHARACTER_NAVIGATE_EVENT = "adnd-character-navigate";

export function openCharacterSheet(characterId: string) {
  window.dispatchEvent(new CustomEvent(CHARACTER_NAVIGATE_EVENT, { detail: { characterId } }));
}

export default function CharacterNameLink({ characterId, children, className = "", onNavigate }: { characterId: string; children: ReactNode; className?: string; onNavigate?: () => void }) {
  return <button type="button" className={`character-name-link ${className}`.trim()} onClick={(event) => { event.stopPropagation(); onNavigate?.(); openCharacterSheet(characterId); }}>{children}</button>;
}
