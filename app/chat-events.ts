export type ChatActionDetail =
  | { kind: "ability"; characterId: string; statIndex: number; mode: "full" | "under" | "value" }
  | { kind: "save"; characterId: string; save: "death" | "wands" | "polymorph" | "breath" | "spells"; label: string; mode: "roll" | "value" }
  | { kind: "character-value"; characterId: string; label: string; value: string | number; roll?: "attack" }
  | { kind: "equipped-attack"; characterId: string }
  | { kind: "derived"; characterId: string; statIndex: number; key: string }
  | { kind: "external-roll"; label: string; roll: "attack" | "save"; modifier?: number; target?: number; tone?: "hostile" }
  | { kind: "combat-result"; content: string; rollDetail?: string; tone?: "hostile" | "psionic" | "psionic-hostile"; emoji?: string; color?: string }
  | { kind: "item"; label: string; quantity?: number; valueGp?: number | null };

export const CHAT_ACTION_EVENT = "adnd-chat-action";

export function sendChatAction(detail: ChatActionDetail) {
  window.dispatchEvent(new CustomEvent<ChatActionDetail>(CHAT_ACTION_EVENT, { detail }));
}
