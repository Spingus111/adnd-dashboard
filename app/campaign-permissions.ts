import type { CampaignState, InventoryContainer, InventoryManagementState, InventoryStack } from "./types.ts";
import type { CombatMutationContext } from "./combat-permissions.ts";
import { partyChatRoleHasGmPermissions } from "./party-chat-role.ts";
import { canControlCombatant } from "./combat-permissions.ts";

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function containerRoot(state: InventoryManagementState, containerId: string) {
  const seen = new Set<string>();
  let current = state.containers.find((container) => container.id === containerId);
  while (current && current.holderType === "container" && !seen.has(current.id)) {
    seen.add(current.id);
    current = state.containers.find((container) => container.id === current!.holderId);
  }
  return current ? { type: current.holderType, id: current.holderId } : null;
}

function stackScope(state: InventoryManagementState, stack: InventoryStack) {
  if (stack.containerId) return containerRoot(state, stack.containerId);
  if (stack.locationId) return { type: "location", id: stack.locationId };
  return stack.placement === "ground" ? { type: "ground", id: stack.campaignId } : null;
}

function containerScope(state: InventoryManagementState, container: InventoryContainer) {
  return containerRoot(state, container.id);
}

function changedRecords<T extends { id: string }>(before: T[], after: T[]) {
  const beforeById = new Map(before.map((entry) => [entry.id, entry]));
  const afterById = new Map(after.map((entry) => [entry.id, entry]));
  return [...new Set([...beforeById.keys(), ...afterById.keys()])]
    .filter((id) => !same(beforeById.get(id), afterById.get(id)))
    .map((id) => ({ before: beforeById.get(id), after: afterById.get(id) }));
}

function inventoryScopeAllowed(scope: { type: string; id: string } | null, controlledOwnerIds: Set<string>) {
  return scope?.type === "ground" || (scope?.type === "owner" && controlledOwnerIds.has(scope.id));
}

export function validateInventoryMutation(previous: CampaignState, next: CampaignState, context: CombatMutationContext | null) {
  if (same(previous.inventoryManagement, next.inventoryManagement)) return null;
  if (partyChatRoleHasGmPermissions(context?.role ?? null)) return null;
  if (context?.role !== "party-member") return "Only a character's player or the GM can change that inventory.";

  const previousCharacters = new Map(previous.characters.map((character) => [character.id, character]));
  const createdCharacterIds = new Set(next.characters.filter((character) => !previousCharacters.has(character.id)).map((character) => character.id));
  const generationCharacterIds = new Set(next.characters.flatMap((character) => {
    const prior = previousCharacters.get(character.id);
    if (!prior) return [];
    const startingInventoryGranted = !prior.startingInventoryGranted && character.startingInventoryGranted;
    const startingWeaponsGranted = !prior.startingWeaponsGranted && character.startingWeaponsGranted;
    const creationInProgress = prior.className === "Unassigned" || prior.statAssignmentComplete === false
      || character.className === "Unassigned" || character.statAssignmentComplete === false;
    return startingInventoryGranted || startingWeaponsGranted || creationInProgress ? [character.id] : [];
  }));
  const controlledCharacterIds = new Set([...context.dockedCharacterIds, ...createdCharacterIds, ...generationCharacterIds]);
  const controlledOwnerIds = new Set(
    [...previous.inventoryManagement.owners, ...next.inventoryManagement.owners]
      .filter((owner) => owner.type === "character" && owner.characterId && controlledCharacterIds.has(owner.characterId))
      .map((owner) => owner.id),
  );
  const ownerChangesAllowed = changedRecords(previous.inventoryManagement.owners, next.inventoryManagement.owners).every(({ before, after }) => {
    if (!after || after.type !== "character" || !after.characterId || (!createdCharacterIds.has(after.characterId) && !generationCharacterIds.has(after.characterId))) return false;
    if (!before) return createdCharacterIds.has(after.characterId);
    return before.id === after.id && before.type === "character" && before.characterId === after.characterId;
  });
  const protectedCollectionsChanged = !ownerChangesAllowed
    || !same(previous.inventoryManagement.locations, next.inventoryManagement.locations)
    || !same(previous.inventoryManagement.layoutPositions, next.inventoryManagement.layoutPositions)
    || previous.inventoryManagement.sellVisible !== next.inventoryManagement.sellVisible
    || !same(previous.inventoryManagement.shoppingCart, next.inventoryManagement.shoppingCart)
    || !same(previous.inventoryManagement.discarded, next.inventoryManagement.discarded);
  if (protectedCollectionsChanged) return "Only the GM can change shared inventory setup, shopping counters, or discarded records.";

  const stackChanges = changedRecords(previous.inventoryManagement.stacks, next.inventoryManagement.stacks);
  const stackAllowed = stackChanges.every(({ before, after }) =>
    (!before || inventoryScopeAllowed(stackScope(previous.inventoryManagement, before), controlledOwnerIds))
    && (!after || inventoryScopeAllowed(stackScope(next.inventoryManagement, after), controlledOwnerIds)));
  if (!stackAllowed) return "You can only move or buy items for a character you control, or interact with Ground.";

  const containerChanges = changedRecords(previous.inventoryManagement.containers, next.inventoryManagement.containers);
  const containerAllowed = containerChanges.every(({ before, after }) => {
    const beforeAllowed = !before || inventoryScopeAllowed(containerScope(previous.inventoryManagement, before), controlledOwnerIds);
    const afterAllowed = !after || inventoryScopeAllowed(containerScope(next.inventoryManagement, after), controlledOwnerIds);
    if (!beforeAllowed || !afterAllowed) return false;
    if (!before?.intrinsic && !after?.intrinsic) return true;
    if (!after?.intrinsic || !after.originCharacterId || !controlledCharacterIds.has(after.originCharacterId)) return false;
    if (!before) return createdCharacterIds.has(after.originCharacterId);
    return before.intrinsic
      && before.id === after.id
      && before.originCharacterId === after.originCharacterId
      && before.containerType === after.containerType
      && before.holderType === after.holderType
      && before.holderId === after.holderId;
  });
  if (!containerAllowed) return "You can only move non-intrinsic containers for a character you control, or interact with Ground.";
  return null;
}

export function validateCampaignAdministration(previous: CampaignState, next: CampaignState, context: CombatMutationContext | null) {
  const campaignAdministrationChanged = previous.activeCharacterCampaignId !== next.activeCharacterCampaignId
    || !same(previous.characterCampaigns, next.characterCampaigns)
    || !same(previous.characterFolders, next.characterFolders);
  if (campaignAdministrationChanged && !partyChatRoleHasGmPermissions(context?.role ?? null)) {
    return "Only the GM or Solo role can switch or manage campaigns.";
  }
  if (!partyChatRoleHasGmPermissions(context?.role ?? null) && !same(previous.stableNpcs, next.stableNpcs)) {
    const beforeById = new Map(previous.stableNpcs.map((npc) => [npc.id, npc]));
    const sameRecordSet = previous.stableNpcs.length === next.stableNpcs.length && next.stableNpcs.every((npc) => beforeById.has(npc.id));
    const onlyControlledCombatFieldsChanged = sameRecordSet && next.stableNpcs.every((npc) => {
      const prior = beforeById.get(npc.id)!;
      if (same(prior, npc)) return true;
      const source = next.segmentedInitiative.participants.find((participant) => participant.stableNpcId === npc.id);
      if (!source || !context || !canControlCombatant(context, source, context.override)) return false;
      if (npc.activeWeaponRulesId === prior.activeWeaponRulesId) return same({ ...prior, currentHp: npc.currentHp }, npc);
      const validWeaponSwitch = Boolean(
        npc.activeWeaponRulesId
        && npc.weaponRulesIds.includes(npc.activeWeaponRulesId)
        && source.weaponRulesId === npc.activeWeaponRulesId
        && source.attackMode === "weapon"
        && source.damageExpression === npc.damageExpression,
      );
      if (!validWeaponSwitch) return false;
      return same({
        ...prior,
        currentHp: npc.currentHp,
        activeWeaponRulesId: npc.activeWeaponRulesId,
        attackMode: npc.attackMode,
        damageExpression: npc.damageExpression,
      }, npc);
    });
    if (!onlyControlledCombatFieldsChanged) return "Only the GM or Solo role can create or edit NPC Stable records.";
  }
  if (!same(previous.discardedStableNpcs, next.discardedStableNpcs) && !partyChatRoleHasGmPermissions(context?.role ?? null)) {
    return "Only the GM or Solo role can discard or restore NPC Stable records.";
  }
  return null;
}
