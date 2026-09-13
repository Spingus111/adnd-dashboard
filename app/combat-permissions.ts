import type { SegmentedParticipant } from "./types";
import type { PartyChatRole } from "./party-chat-role";

export type CombatIdentity = {
  role: PartyChatRole | null;
  dockedCharacterIds: string[];
  clientId?: string | null;
};

export type CombatMutationContext = CombatIdentity & {
  sourceParticipantId: string | null;
  override: boolean;
};

export const COMBAT_MUTATION_EVENT = "adnd-combat-mutation";

export function canControlCombatProgression(identity: CombatIdentity, _override = false) {
  return identity.role === "gm" || identity.role === "solo";
}

export function isAlliedNpc(combatant: Pick<SegmentedParticipant, "kind" | "side">) {
  return combatant.kind === "npc" && combatant.side === "party";
}

export function canControlCombatant(
  identity: CombatIdentity,
  combatant: Pick<SegmentedParticipant, "kind" | "side" | "characterId">,
  override = false,
) {
  if (override || identity.role === "solo" || identity.role === "gm") return true;
  if (identity.role !== "party-member") return false;
  if (isAlliedNpc(combatant)) return true;
  return combatant.kind === "character"
    && Boolean(combatant.characterId && identity.dockedCharacterIds.includes(combatant.characterId));
}

export function announceCombatMutation(context: CombatMutationContext) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMBAT_MUTATION_EVENT, { detail: context }));
}
