import type { CampaignState, SegmentedParticipant } from "./types";
import { canControlCombatant, canControlCombatProgression, type CombatMutationContext } from "./combat-permissions.ts";

function changed(a: unknown, b: unknown) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function onlyDamageConsequenceChanged(before: SegmentedParticipant, after: SegmentedParticipant) {
  if (before.currentHp === after.currentHp) return false;
  const consequenceKeys = new Set(["currentHp", "temporaryDamage", "action", "actionDetail", "targetId", "targetIds", "statusNote", "ready", "completedEvents"]);
  const beforeStable = Object.fromEntries(Object.entries(before).filter(([key]) => !consequenceKeys.has(key)));
  const afterStable = Object.fromEntries(Object.entries(after).filter(([key]) => !consequenceKeys.has(key)));
  return !changed(beforeStable, afterStable);
}

export function validateCombatMutation(previous: CampaignState, next: CampaignState, context: CombatMutationContext | null) {
  if (!changed(previous.segmentedInitiative, next.segmentedInitiative)
    && !changed(previous.characters, next.characters)) return null;
  if (!context) return "A combat identity is required to change combat state.";

  const before = previous.segmentedInitiative;
  const after = next.segmentedInitiative;
  const authorityChanged = before.round !== after.round
    || before.phase !== after.phase
    || before.currentSegment !== after.currentSegment
    || before.enabled !== after.enabled;
  if (authorityChanged && !canControlCombatProgression(context, context.override)) {
    return "Only the GM or Solo role can advance the shared combat state.";
  }

  const beforeById = new Map(before.participants.map((participant) => [participant.id, participant]));
  const afterById = new Map(after.participants.map((participant) => [participant.id, participant]));
  const participantSetChanged = before.participants.some((participant) => !afterById.has(participant.id))
    || after.participants.some((participant) => !beforeById.has(participant.id));
  if (participantSetChanged && !canControlCombatProgression(context, context.override)) {
    return "Only the GM or Solo role can add or remove combatants.";
  }

  const source = context.sourceParticipantId
    ? afterById.get(context.sourceParticipantId) ?? beforeById.get(context.sourceParticipantId)
    : null;
  const sourceControlled = Boolean(source && canControlCombatant(context, source, context.override));
  const changedParticipants = after.participants.filter((participant) => {
    const prior = beforeById.get(participant.id);
    return prior && changed(prior, participant);
  });
  const progressionMutation = authorityChanged && canControlCombatProgression(context, context.override);
  const unauthorizedParticipantChange = !progressionMutation && changedParticipants.some((participant) => {
    if (canControlCombatant(context, participant, context.override)) return false;
    const prior = beforeById.get(participant.id);
    return !sourceControlled || !prior || !onlyDamageConsequenceChanged(prior, participant);
  });
  if (unauthorizedParticipantChange) {
    return "This identity does not control one or more changed combatants.";
  }

  const changedCharacterIds = next.characters.filter((character) => {
    const prior = previous.characters.find((entry) => entry.id === character.id);
    return prior && changed(prior, character);
  }).map((character) => character.id);
  if (changedCharacterIds.length && !sourceControlled) {
    const linkedParticipants = changedCharacterIds.map((characterId) => after.participants.find((participant) => participant.characterId === characterId)).filter((participant): participant is SegmentedParticipant => Boolean(participant));
    if (linkedParticipants.some((participant) => !canControlCombatant(context, participant, context.override))) {
      return "This identity does not control one or more changed characters.";
    }
  }

  const participantIndependentCombatChange = changed(before.effects, after.effects)
    || changed(before.engagements, after.engagements)
    || changed(before.grappleHolds, after.grappleHolds)
    || changed(before.pendingUnarmed, after.pendingUnarmed)
    || changed(before.combatTallies, after.combatTallies)
    || before.partyRoll !== after.partyRoll
    || before.oppositionRoll !== after.oppositionRoll;
  if (participantIndependentCombatChange && !sourceControlled && !canControlCombatProgression(context, context.override)) {
    return "This combat result requires control of its acting combatant.";
  }
  return null;
}
