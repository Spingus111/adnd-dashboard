export const PARTY_CHAT_PREFERENCES_KEY = "adnd-party-chat-preferences";

export type PartyChatRole = "party-member" | "gm" | "solo";

type StoredPartyChatPreferences = {
  role?: unknown;
  gmRole?: unknown;
};

export function partyChatRoleFromPreferences(value: StoredPartyChatPreferences | null | undefined): PartyChatRole | null {
  if (value?.role === "party-member" || value?.role === "gm" || value?.role === "solo") return value.role;
  if (typeof value?.gmRole === "boolean") return value.gmRole ? "gm" : "party-member";
  return null;
}

export function partyChatRoleHasGmPermissions(role: PartyChatRole | null) {
  return role === "gm" || role === "solo";
}

export function partyChatRoleForOneTimeGmReset(clientId: string | null | undefined, resetGmClientId: string | null | undefined): PartyChatRole {
  return clientId && clientId === resetGmClientId ? "gm" : "party-member";
}

export function partyChatRoleCanGenerateCharacters(role: PartyChatRole | null) {
  return role === "party-member" || role === "gm" || role === "solo";
}

export function combatDeclarationIsHidden({
  phase,
  showAllDeclarations,
  role,
  controlHeld,
  participantKind,
}: {
  phase: string;
  showAllDeclarations: boolean;
  role: PartyChatRole | null;
  controlHeld: boolean;
  participantKind: "character" | "enemy" | "npc";
}) {
  if (phase !== "declaration" || showAllDeclarations || role === "solo") return false;
  if (role === "gm") return participantKind === "character" && !controlHeld;
  return participantKind === "enemy";
}
