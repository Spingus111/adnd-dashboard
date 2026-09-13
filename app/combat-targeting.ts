import type { SegmentedParticipant } from "./types.ts";

export function participantIsConscious(participant: Pick<SegmentedParticipant, "currentHp" | "action" | "statusNote">) {
  return Number(participant.currentHp) > 0
    && participant.action !== "unconscious"
    && participant.action !== "die"
    && participant.statusNote !== "EXSANGUINATED";
}

export function pruneInvalidCombatTargets(participants: SegmentedParticipant[]) {
  const validIds = new Set(participants.filter(participantIsConscious).map((participant) => participant.id));
  return participants.map((participant) => {
    const targetId = participant.targetId && validIds.has(participant.targetId) ? participant.targetId : null;
    const targetIds = participant.targetIds.filter((id) => validIds.has(id));
    return targetId === participant.targetId && targetIds.length === participant.targetIds.length
      ? participant
      : { ...participant, targetId, targetIds };
  });
}
