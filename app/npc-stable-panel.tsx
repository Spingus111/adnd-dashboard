"use client";

import { useEffect, useRef, useState } from "react";
import type { CampaignState, StableNpc, StableNpcTemplateId } from "./types";
import { discardInventoryOwner } from "./inventory-management";
import {
  addStableNpcInventory,
  createStableNpc,
  nextStableNpcNumber,
  stableNpcTemplates,
  stableNpcToParticipant,
  syncStableNpcInventory,
  templateForStableNpc,
} from "./npc-stable";
import { PARTY_CHAT_PREFERENCES_KEY, partyChatRoleFromPreferences, partyChatRoleHasGmPermissions } from "./party-chat-role";
import { sharedId } from "./shared-id";
import { phbWeaponRules, weaponRulesById } from "./weapon-rules";
import { WeaponRulesTooltip } from "./weapon-rules-tooltip";
import { naturalArmorProfiles, wornArmorProfiles } from "./monster-armor";
import { normalizeUnarmedOverrides } from "./unarmed-combat";
import { normalizePsionics, psionicAttackModes, psionicDefenseModes } from "./psionics";
import { osricEquipmentDefaults } from "./equipment-defaults";
import { siteCatalog } from "./catalog-data";

type Props = {
  campaign: CampaignState;
  setCampaign: React.Dispatch<React.SetStateAction<CampaignState>>;
  onPlaceNpc?: (npcId: string) => void;
  standalone?: boolean;
};

const weaponOptions = phbWeaponRules.filter((weapon) => weapon.shopping !== false);

function gmPermissions() {
  try {
    return partyChatRoleHasGmPermissions(partyChatRoleFromPreferences(JSON.parse(window.localStorage.getItem(PARTY_CHAT_PREFERENCES_KEY) || "{}")));
  } catch { return false; }
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function rerollNpc(npc: StableNpc) {
  const number = Number(npc.token.replace(/^[A-Z]+/, "")) || 1;
  const rerolled = createStableNpc(npc.campaignId, npc.templateId, npc.subtypeId, number);
  return { ...npc, currentHp: rerolled.maxHp, maxHp: rerolled.maxHp, hitDice: rerolled.hitDice };
}

function npcEquipmentSummary(npc: StableNpc) {
  return npc.equipmentRefs.map((reference) => {
    const label = reference.source === "equipment"
      ? osricEquipmentDefaults.find((entry) => entry.id === reference.id)?.name
      : siteCatalog.find((entry) => entry.id === reference.id)?.name;
    return label ? `${label}${reference.quantity > 1 ? ` ×${reference.quantity}` : ""}` : null;
  }).filter(Boolean).join(" · ");
}

function equipmentRefsWithWeapons(npc: StableNpc, weaponRulesIds: string[]) {
  const oldWeaponIds = new Set(npc.weaponRulesIds);
  return [...npc.equipmentRefs.filter((reference) => reference.source !== "equipment" || !oldWeaponIds.has(reference.id)), ...weaponRulesIds.map((id) => ({ source: "equipment" as const, id, quantity: 1 }))];
}

function DraftInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return <input value={draft} onFocus={() => { focused.current = true; }} onChange={(event) => setDraft(event.target.value)} onBlur={() => { focused.current = false; if (draft !== value) onCommit(draft); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />;
}

function DraftTextarea({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return <textarea value={draft} onFocus={() => { focused.current = true; }} onChange={(event) => setDraft(event.target.value)} onBlur={() => { focused.current = false; if (draft !== value) onCommit(draft); }} />;
}

export default function NpcStablePanel({ campaign, setCampaign, onPlaceNpc, standalone = false }: Props) {
  const [templateId, setTemplateId] = useState<StableNpcTemplateId>("heavy-foot");
  const [subtypeId, setSubtypeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [canManage, setCanManage] = useState(false);
  const activeCampaignId = campaign.activeCharacterCampaignId;
  const template = templateForStableNpc(templateId);
  const stableNpcs = campaign.stableNpcs.filter((npc) => npc.campaignId === activeCampaignId);

  useEffect(() => {
    const refresh = () => setCanManage(gmPermissions());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("adnd-role-change", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("adnd-role-change", refresh); };
  }, []);

  useEffect(() => { setSubtypeId(template.subtypes?.[0]?.id ?? null); }, [template.id]);

  function createNpcs() {
    if (!canManage) return;
    setCampaign((current) => {
      const created: StableNpc[] = [];
      let nextNumber = nextStableNpcNumber(current.stableNpcs, current.activeCharacterCampaignId, templateId);
      for (let index = 0; index < Math.max(1, Math.min(50, quantity)); index += 1) {
        created.push(createStableNpc(current.activeCharacterCampaignId, templateId, subtypeId, nextNumber));
        nextNumber += 1;
      }
      const inventoryManagement = created.reduce(addStableNpcInventory, current.inventoryManagement);
      return { ...current, stableNpcs: [...current.stableNpcs, ...created], inventoryManagement };
    });
  }

  function updateNpc(npcId: string, patch: Partial<StableNpc>) {
    if (!canManage) return;
    setCampaign((current) => {
      const prior = current.stableNpcs.find((npc) => npc.id === npcId);
      if (!prior) return current;
      const next = { ...prior, ...patch };
      const participantDefaults = stableNpcToParticipant(next, current.segmentedInitiative.round);
      return {
        ...current,
        stableNpcs: current.stableNpcs.map((npc) => npc.id === npcId ? next : npc),
        inventoryManagement: syncStableNpcInventory(current.inventoryManagement, next),
        segmentedInitiative: {
          ...current.segmentedInitiative,
          participants: current.segmentedInitiative.participants.map((participant) => participant.stableNpcId === npcId ? {
            ...participant,
            name: participantDefaults.name,
            hitDice: participantDefaults.hitDice,
            attackBonus: participantDefaults.attackBonus,
            armorClass: participantDefaults.armorClass,
            currentHp: participantDefaults.currentHp,
            maxHp: participantDefaults.maxHp,
            damageExpression: participantDefaults.damageExpression,
            armorMode: participantDefaults.armorMode,
            armorProfile: participantDefaults.armorProfile,
            attackMode: participantDefaults.attackMode,
            naturalSpeed: participantDefaults.naturalSpeed,
            weaponRulesId: participantDefaults.weaponRulesId,
            large: participantDefaults.large,
          } : participant),
        },
      };
    });
  }

  function applyTemplate(npc: StableNpc, nextTemplateId: StableNpcTemplateId, nextSubtypeId: string | null) {
    if (!canManage) return;
    const number = Number(npc.token.replace(/^[A-Z]+/, "")) || 1;
    const fresh = createStableNpc(npc.campaignId, nextTemplateId, nextSubtypeId, number);
    updateNpc(npc.id, { ...fresh, id: npc.id, name: npc.name, token: `${templateForStableNpc(nextTemplateId).prefix}${number}`, notes: npc.notes });
  }

  function toggleExpedition(npcId: string) {
    setCampaign((current) => {
      const selected = current.expeditionNpcIds.includes(npcId);
      return {
        ...current,
        expeditionNpcIds: selected ? current.expeditionNpcIds.filter((id) => id !== npcId) : [...current.expeditionNpcIds, npcId],
        dashboard: selected ? {
          ...current.dashboard,
          marchingOrderIds: current.dashboard.marchingOrderIds.filter((id) => id !== npcId),
          marchingOrderSlots: current.dashboard.marchingOrderSlots.map((id) => id === npcId ? null : id),
          lightCarrierIds: current.dashboard.lightCarrierIds.filter((id) => id !== npcId),
          scoutingCharacterId: current.dashboard.scoutingCharacterId === npcId ? null : current.dashboard.scoutingCharacterId,
        } : current.dashboard,
      };
    });
  }

  function discardNpc(npc: StableNpc) {
    if (!canManage || !window.confirm(`Move ${npc.name} to discard? Its inventory and contents remain recoverable.`)) return;
    setCampaign((current) => {
      const inventoryResult = current.inventoryManagement.owners.some((owner) => owner.id === npc.id)
        ? discardInventoryOwner(current.inventoryManagement, npc.id)
        : { state: current.inventoryManagement, discarded: false };
      const inventoryDiscardId = inventoryResult.discarded ? inventoryResult.state.discarded[0]?.id ?? null : null;
      return {
        ...current,
        stableNpcs: current.stableNpcs.filter((entry) => entry.id !== npc.id),
        discardedStableNpcs: [{ id: sharedId(), npc, discardedAt: Date.now(), inventoryDiscardId }, ...current.discardedStableNpcs],
        expeditionNpcIds: current.expeditionNpcIds.filter((id) => id !== npc.id),
        inventoryManagement: inventoryResult.state,
        dashboard: {
          ...current.dashboard,
          marchingOrderIds: current.dashboard.marchingOrderIds.filter((id) => id !== npc.id),
          marchingOrderSlots: current.dashboard.marchingOrderSlots.map((id) => id === npc.id ? null : id),
          lightCarrierIds: current.dashboard.lightCarrierIds.filter((id) => id !== npc.id),
          scoutingCharacterId: current.dashboard.scoutingCharacterId === npc.id ? null : current.dashboard.scoutingCharacterId,
        },
        segmentedInitiative: { ...current.segmentedInitiative, participants: current.segmentedInitiative.participants.filter((participant) => participant.stableNpcId !== npc.id) },
      };
    });
  }

  const stableSummary = <span><b>NPC Stable</b><small>{stableNpcs.length} campaign NPC{stableNpcs.length === 1 ? "" : "s"} · {campaign.expeditionNpcIds.filter((id) => stableNpcs.some((npc) => npc.id === id)).length} on expedition</small></span>;
  const stableBody = <div className="npc-stable-body">
      <fieldset className="npc-stable-create" disabled={!canManage}>
        <label>Template<select value={templateId} onChange={(event) => setTemplateId(event.target.value as StableNpcTemplateId)}>{stableNpcTemplates.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}</select></label>
        {template.subtypes && <label>Subtype<select value={subtypeId ?? template.subtypes[0].id} onChange={(event) => setSubtypeId(event.target.value)}>{template.subtypes.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}</select></label>}
        <label>Quantity<input type="number" min="1" max="50" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(50, Number(event.target.value) || 1)))} /></label>
        <button type="button" className="primary-button" onClick={createNpcs}>Create {quantity > 1 ? `${quantity} NPCs` : "NPC"}</button>
      </fieldset>
      {!canManage && <p className="rule-note">GM or Solo creates and edits Stable records. Expedition placement remains shared.</p>}
      <div className="npc-stable-list">
        {stableNpcs.length === 0 ? <p className="compact-empty">No persistent NPCs yet.</p> : stableNpcs.map((npc) => {
          const selected = campaign.expeditionNpcIds.includes(npc.id);
          const activeWeapon = weaponRulesById(npc.activeWeaponRulesId);
          const subtypeOptions = templateForStableNpc(npc.templateId).subtypes;
          return <details className="npc-stable-row" key={npc.id}>
            <summary><span className="npc-token">{npc.token}</span><span className="npc-stable-identity"><b>{npc.name}</b><small>HP {npc.currentHp}/{npc.maxHp} · AC {npc.armorClass} · Move {npc.movementRate}{activeWeapon ? <> · <WeaponRulesTooltip rules={activeWeapon}>{activeWeapon.name}</WeaponRulesTooltip></> : npc.noncombatant ? " · Noncombatant" : ` · ${npc.damageExpression}`}</small></span><button type="button" className={selected ? "expedition-toggle selected" : "expedition-toggle"} onClick={(event) => { event.preventDefault(); toggleExpedition(npc.id); }}>{selected ? "On expedition" : "Add"}</button><i aria-hidden>▸</i></summary>
            <div className="npc-stable-editor">
              {selected && <div className="npc-expedition-actions">{onPlaceNpc && <button type="button" onClick={() => onPlaceNpc(npc.id)}>Place in march</button>}{npc.templateId === "horse" && <small>Horses are poor dungeon animals; assignment remains allowed.</small>}</div>}
              <fieldset disabled={!canManage}>
                <label>Name<DraftInput value={npc.name} onCommit={(name) => updateNpc(npc.id, { name })} /></label>
                <label>Template<select value={npc.templateId} onChange={(event) => applyTemplate(npc, event.target.value as StableNpcTemplateId, null)}>{stableNpcTemplates.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}</select></label>
                {subtypeOptions && <label>Subtype<select value={npc.subtypeId ?? subtypeOptions[0].id} onChange={(event) => applyTemplate(npc, npc.templateId, event.target.value)}>{subtypeOptions.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}</select></label>}
                <label>Current HP<input type="number" value={npc.currentHp} onChange={(event) => updateNpc(npc.id, { currentHp: Number(event.target.value) || 0 })} /></label>
                <label>Maximum HP<span className="npc-inline-input"><input type="number" min="1" value={npc.maxHp} onChange={(event) => updateNpc(npc.id, { maxHp: Math.max(1, Number(event.target.value) || 1) })} /><button type="button" title="Reroll HP" aria-label={`Reroll ${npc.name} HP`} onClick={() => updateNpc(npc.id, rerollNpc(npc))}>🎲</button></span></label>
                <label>AC<input type="number" value={npc.armorClass} onChange={(event) => updateNpc(npc.id, { armorClass: Number(event.target.value) || 10 })} /></label>
                <label>Armour<select value={`${npc.armorMode}:${npc.armorProfile ?? "flesh"}`} onChange={(event) => {
                  const [mode, profile] = event.target.value.split(":") as ["natural" | "worn", StableNpc["armorProfile"]];
                  const worn = mode === "worn" ? wornArmorProfiles.find((entry) => entry.id === profile) : null;
                  updateNpc(npc.id, { armorMode: mode, armorProfile: profile, ...(worn ? { armorClass: worn.ascendingAc } : {}) });
                }}><optgroup label="Natural">{naturalArmorProfiles.map((profile) => <option value={`natural:${profile.id}`} key={`natural:${profile.id}`}>{profile.label}</option>)}</optgroup><optgroup label="Worn">{wornArmorProfiles.map((profile) => <option value={`worn:${profile.id}`} key={`worn:${profile.id}`}>{profile.label}</option>)}</optgroup></select></label>
                <label>Movement<input type="number" min="0" value={npc.movementRate} onChange={(event) => updateNpc(npc.id, { movementRate: Math.max(0, Number(event.target.value) || 0) })} /></label>
                <label>Primary weapon<select value={npc.activeWeaponRulesId ?? ""} onChange={(event) => { const rules = weaponRulesById(event.target.value); const weaponRulesIds = rules ? Array.from(new Set([rules.id, ...npc.weaponRulesIds])) : npc.weaponRulesIds; updateNpc(npc.id, { activeWeaponRulesId: rules?.id ?? null, attackMode: rules ? "weapon" : "natural", damageExpression: rules?.damageSM ?? npc.damageExpression, weaponRulesIds, equipmentRefs: equipmentRefsWithWeapons(npc, weaponRulesIds) }); }}><option value="">Natural / none</option>{weaponOptions.map((weapon) => <option value={weapon.id} key={weapon.id}>{weapon.name}</option>)}</select></label>
                <label>Backup weapon<select value={npc.weaponRulesIds.find((id) => id !== npc.activeWeaponRulesId) ?? ""} onChange={(event) => { const weaponRulesIds = [npc.activeWeaponRulesId, event.target.value].filter((id): id is string => Boolean(id)); updateNpc(npc.id, { weaponRulesIds, equipmentRefs: equipmentRefsWithWeapons(npc, weaponRulesIds) }); }}><option value="">None</option>{weaponOptions.map((weapon) => <option value={weapon.id} key={weapon.id}>{weapon.name}</option>)}</select></label>
                <label>Damage<DraftInput value={npc.damageExpression} onCommit={(damageExpression) => updateNpc(npc.id, { damageExpression })} /></label>
                <label>Attack bonus<input type="number" value={npc.attackBonus} onChange={(event) => updateNpc(npc.id, { attackBonus: Number(event.target.value) || 0 })} /></label>
                <details className="unarmed-override-editor"><summary><span><b>UNARMED</b><small>Optional OSRIC overrides · blanks derive</small></span><i aria-hidden>▸</i></summary><div>
                  {([['hitTargetNumber','Unarmed Hit TN'],['hitAttackModifier','Hit ATK Mod'],['hitDefenseModifier','Hit DEF Mod'],['overbearAttackModifier','Overbear ATK'],['overbearDefenseModifier','Overbear DEF'],['grappleAttackModifier','Grapple ATK'],['grappleDefenseModifier','Grapple DEF'],['magicArmorBonus','Magic armour +']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" value={npc.unarmedOverrides?.[key] ?? ""} onChange={(event) => updateNpc(npc.id, { unarmedOverrides: { ...normalizeUnarmedOverrides(npc.unarmedOverrides), [key]: event.target.value === "" ? null : Number(event.target.value) } })} /></label>)}
                  <label>Appendages<input type="number" min="1" value={npc.unarmedOverrides?.appendages ?? 2} onChange={(event) => updateNpc(npc.id, { unarmedOverrides: { ...normalizeUnarmedOverrides(npc.unarmedOverrides), appendages: Math.max(1, Number(event.target.value) || 2) } })} /></label>
                  <fieldset><legend>Capabilities</legend>{([['cannotGrapple','Cannot Grapple'],['cannotBeGrappled','Cannot Be Grappled'],['cannotOverbear','Cannot Overbear'],['cannotBeOverborne','Cannot Be Overborne'],['immuneTemporaryDamage','Immune to Temporary Damage'],['fourLegged','Four-legged movement']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(npc.unarmedOverrides?.[key])} onChange={(event) => updateNpc(npc.id, { unarmedOverrides: { ...normalizeUnarmedOverrides(npc.unarmedOverrides), [key]: event.target.checked } })} />{label}</label>)}</fieldset>
                </div></details>
                <details className="unarmed-override-editor psionics-setup-editor"><summary><span><b>PSIONICS</b><small>Attack/defense pools and known combat modes</small></span><i aria-hidden>▸</i></summary><div>
                  {(() => { const psionics = normalizePsionics(npc.psionics); const updatePsionics = (patch: Partial<typeof psionics>) => updateNpc(npc.id, { psionics: normalizePsionics({ ...psionics, ...patch }) }); return <>
                    <fieldset><legend>Psionic status</legend><label><input type="checkbox" checked={psionics.enabled} onChange={(event) => updatePsionics({ enabled: event.target.checked })} />Psionic combatant</label>{psionics.enabled && <small>Mind Blank is automatic. Add other known modes below.</small>}</fieldset>
                    <label>Attack points<input type="number" min="0" disabled={!psionics.enabled} value={psionics.currentAttackPoints} onChange={(event) => updatePsionics({ currentAttackPoints: Number(event.target.value) || 0 })} /></label>
                    <label>Attack maximum<input type="number" min="0" disabled={!psionics.enabled} value={psionics.maxAttackPoints} onChange={(event) => updatePsionics({ maxAttackPoints: Number(event.target.value) || 0 })} /></label>
                    <label>Defense points<input type="number" min="0" disabled={!psionics.enabled} value={psionics.currentDefensePoints} onChange={(event) => updatePsionics({ currentDefensePoints: Number(event.target.value) || 0 })} /></label>
                    <label>Defense maximum<input type="number" min="0" disabled={!psionics.enabled} value={psionics.maxDefensePoints} onChange={(event) => updatePsionics({ maxDefensePoints: Number(event.target.value) || 0 })} /></label>
                    <fieldset disabled={!psionics.enabled}><legend>Attack modes</legend>{psionicAttackModes.map((mode) => <label key={mode}><input type="checkbox" checked={psionics.attackModes.includes(mode)} onChange={(event) => updatePsionics({ attackModes: event.target.checked ? [...psionics.attackModes, mode] : psionics.attackModes.filter((entry) => entry !== mode) })} />{mode}</label>)}</fieldset>
                    <fieldset disabled={!psionics.enabled}><legend>Defense modes</legend>{psionicDefenseModes.map((mode) => mode === "Mind Blank" ? <label key={mode}><input type="checkbox" checked disabled />{mode} · automatic</label> : <label key={mode}><input type="checkbox" checked={psionics.defenseModes.includes(mode)} onChange={(event) => updatePsionics({ defenseModes: event.target.checked ? [...psionics.defenseModes, mode] : psionics.defenseModes.filter((entry) => entry !== mode) })} />{mode}</label>)}</fieldset>
                  </>; })()}
                </div></details>
                {npc.carryingCapacityStone != null && <label>Capacity<input type="number" min="0" value={npc.carryingCapacityStone} onChange={(event) => updateNpc(npc.id, { carryingCapacityStone: Math.max(0, Number(event.target.value) || 0) })} /><small>Stone</small></label>}
                <label className="npc-notes-field">Notes<DraftTextarea value={npc.notes} onCommit={(notes) => updateNpc(npc.id, { notes })} /></label>
              </fieldset>
              {npc.equipmentRefs.length > 0 && <small className="npc-equipment-summary">Kit · {npcEquipmentSummary(npc)}</small>}
              {canManage && <button type="button" className="action-link danger-link" onClick={() => discardNpc(npc)}>Move to discard</button>}
            </div>
          </details>;
        })}
      </div>
      {campaign.discardedStableNpcs.some((entry) => entry.npc.campaignId === activeCampaignId) && <small>Discarded Stable records can be restored from Character &amp; NPC discard in Characters → Edit / Setup.</small>}
    </div>;
  return standalone
    ? <section className="npc-stable npc-stable-standalone"><header>{stableSummary}</header>{stableBody}</section>
    : <details className="npc-stable"><summary>{stableSummary}<i aria-hidden>▸</i></summary>{stableBody}</details>;
}
