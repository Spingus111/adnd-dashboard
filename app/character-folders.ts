import type { PartyChatRole } from "./party-chat-role";

export function characterFolderStartsOpen(role: PartyChatRole | null, dockedCharacterIds: string[], folderCharacterIds: string[]) {
  if (role === "gm" || role === "solo") return folderCharacterIds.length > 0;
  const docked = new Set(dockedCharacterIds);
  return folderCharacterIds.some((characterId) => docked.has(characterId));
}
