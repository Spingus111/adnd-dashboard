"use client";

import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import EmojiPicker from "emoji-picker-react";
import type { CampaignState, Character, SaveBlock } from "./types";
import FormattedNumberInput from "./formatted-number-input";
import HpBar from "./hp-bar";
import HpMathInput from "./hp-math-input";
import { sendChatAction } from "./chat-events";
import { abilityNames, derivedAbilityItems, strengthScoreLabel } from "./osric-stats";
import { saveIcons } from "./save-icons";
import { effectiveArmorMovementRate, movementSummary } from "./movement";
import { spellPreparationHours } from "./spellcasting";
import {
  OSRIC_SPELLS,
  canSpecialize,
  classComponents,
  getLegalWeaponProficiencies,
  getProficiencyCapacity,
  getSpellcastingTracks,
  specializationCost,
  spellTrackLabel,
  trainingSlotsUsed,
} from "./osric-advancement";
import { characterTileStyle } from "./tile-color";
import { PARTY_CHAT_PREFERENCES_KEY, partyChatRoleCanGenerateCharacters, partyChatRoleFromPreferences, partyChatRoleHasGmPermissions, type PartyChatRole } from "./party-chat-role";
import { sharedId } from "./shared-id";
import { restoreInventoryDiscard } from "./inventory-management";
import { addStableNpcInventory } from "./npc-stable";
import { weaponRulesById } from "./weapon-rules";
import CharacterInventoryPanel from "./character-inventory-panel";
import { characterFolderStartsOpen } from "./character-folders";
import {
  OSRIC_ABILITIES,
  ancestryQualifications,
  closestClassMisses,
  finalStatsFromRaw,
  formatAdjustments,
  humanDualClassOptions,
  qualifyingCombinations,
  rollStatPool,
  statlineFromStrings,
  type OsricStatline,
} from "./osric-character-creation";
import { ageAdjustmentsFor, constitutionHitPointBonusPerDie, rollCharacterHitPoints } from "./character-rules";
import { abilitiesForAncestry } from "./ancestry-abilities";
import { attackModesKnown, defenseModesKnown, disciplineCounts, majorDisciplineNames, minorDisciplineNames, normalizePsionics, psionicAttackModes, psionicDefenseModes, psionicPotentialModifier, psionicStrengthBonus, psionicsEligible, psionicDisciplineRules } from "./psionics";
import { PsionicAttackModeTooltip, PsionicDefenseModeTooltip, PsionicDisciplineTooltip, PsionicTermInfoButton } from "./psionics-rules-tooltip";
import { rollSecureDie } from "./random";

const saveFields: Array<[keyof SaveBlock, string, string]> = [
  ["wands", "Aimed magical items", saveIcons.wands],
  ["breath", "Breath weapons", saveIcons.breath],
  ["death", "Death / Paralysis / Poison", saveIcons.death],
  ["polymorph", "Petrifaction / Polymorph", saveIcons.polymorph],
  ["spells", "Spells / unlisted", saveIcons.spells],
];
const EMPTY_STAT_POOL: number[] = [];
const PLAYER_ALIGNMENTS: NonNullable<Character["alignment"]>[] = ["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "True Neutral", "Chaotic Neutral"];

type CharacterSheetPanelProps = {
  campaign: CampaignState;
  setCampaign: Dispatch<SetStateAction<CampaignState>>;
  characters: Character[];
  expandedCharacterIds: string[];
  setExpandedCharacterIds: Dispatch<SetStateAction<string[]>>;
  emojiPickerFor: string | null;
  setEmojiPickerFor: Dispatch<SetStateAction<string | null>>;
  updateCharacter: (characterId: string, patch: Partial<Character>) => void;
  addCharacter: () => void;
  moveCharacter: (characterId: string, direction: -1 | 1) => void;
  toggleCharacterExpanded: (characterId: string) => void;
  removeCharacter: (characterId: string) => void;
  restoreDiscardedCharacter: (discardId: string) => void;
  toggleMissionCharacter: (characterId: string) => void;
  createCharacterCampaign: () => void;
  renameCharacterCampaign: () => void;
  deleteCharacterCampaign: () => void;
};

function colorChannels(color: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : "#dfe9d9";
  return [parseInt(normalized.slice(1, 3), 16), parseInt(normalized.slice(3, 5), 16), parseInt(normalized.slice(5, 7), 16)];
}

function changeColorChannel(color: string, index: number, value: number) {
  const channels = colorChannels(color);
  channels[index] = Math.max(0, Math.min(255, value));
  return "#" + channels.map((channel) => channel.toString(16).padStart(2, "0")).join("");
}

function DeferredColorEditor({ label, value, onApply, compact = false }: { label: string; value: string; onApply: (color: string) => void; compact?: boolean }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const dirty = draft.toLowerCase() !== value.toLowerCase();
  return (
    <div className={compact ? "deferred-color-editor compact" : "deferred-color-editor"}>
      <label>{label}<input aria-label={label} type="color" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
      {!compact && (["R", "G", "B"] as const).map((channel, channelIndex) => <label key={channel}>{channel}<input aria-label={`${label} ${channel} value`} type="number" min="0" max="255" value={colorChannels(draft)[channelIndex]} onChange={(event) => setDraft(changeColorChannel(draft, channelIndex, Number(event.target.value) || 0))} /></label>)}
      <button type="button" className="secondary-button apply-color-button" disabled={!dirty} onClick={() => onApply(draft)}>Apply color</button>
    </div>
  );
}

function inventoryCapacity(strength: string) {
  return 10 + Math.max(3, Math.min(19, Number(strength) || 10));
}

function ensureInventoryLines(character: Character, strength: string) {
  const lines = [...character.inventoryLines];
  while (lines.length < inventoryCapacity(strength)) lines.push({ id: sharedId(), name: "", info: "", quantity: 1 });
  return lines;
}

function statStrings(values: OsricStatline): Character["stats"] {
  return values.map(String) as Character["stats"];
}

function CharacterCreationLab({ character, updateCharacter, canEditGeneratedStats, gmOverride }: { character: Character; updateCharacter: (patch: Partial<Character>) => void; canEditGeneratedStats: boolean; gmOverride: boolean }) {
  const pool = character.statPool ?? EMPTY_STAT_POOL;
  const fallbackAllocation = character.className === "Unassigned" && pool.length === 6 ? statStrings(pool as OsricStatline) : character.stats;
  const raw = statlineFromStrings(character.rawStats ?? fallbackAllocation);
  const final = finalStatsFromRaw(raw, character.race);
  const classLocked = character.statAssignmentComplete !== false && character.className !== "Unassigned";
  const scoresLocked = character.scoresLocked ?? classLocked;
  const raceLocked = character.raceLocked ?? classLocked;
  const ancestryOptions = ancestryQualifications(raw);
  const availableAncestries = ancestryOptions.filter((ancestry) => ancestry.qualified);
  const unavailableAncestries = ancestryOptions.filter((ancestry) => !ancestry.qualified);
  const selectedAncestry = ancestryOptions.find((ancestry) => ancestry.name === character.race);
  const qualified = qualifyingCombinations(character.race, final);
  const misses = closestClassMisses(character.race, final);
  const dualClasses = character.race.toLowerCase() === "human" ? humanDualClassOptions(character.className, final) : [];
  const selectedClassIsLegal = qualified.includes(character.className);
  const ageAdjustments = ageAdjustmentsFor(character.race, Number.parseInt(character.age, 10) || 0);
  const constitutionHpBonus = constitutionHitPointBonusPerDie(character.stats[2], character.className);
  const [selectedAbilities, setSelectedAbilities] = useState<number[]>([]);

  function reroll() {
    if (!canEditGeneratedStats || scoresLocked || (pool.length === 6 && !window.confirm("Replace all six rolled scores?"))) return;
    const rolled = rollStatPool();
    const rawStats = statStrings(rolled.totals as OsricStatline);
    setSelectedAbilities([]);
    updateCharacter({ statPool: rolled.totals, statRolls: rolled.dice, rawStats, stats: statStrings(finalStatsFromRaw(rolled.totals as OsricStatline, character.race)), className: "Unassigned", classLevels: {}, statAssignmentComplete: false, scoresLocked: false, raceLocked: false, age: "", height: "", weight: "", startingHpRolled: false, currentHp: 1, maxHp: 1, inventoryLines: ensureInventoryLines(character, rawStats[0]) });
  }

  function chooseAncestry(race: string) {
    if (!canEditGeneratedStats || !scoresLocked || raceLocked || !ancestryOptions.find((ancestry) => ancestry.name === race)?.qualified) return;
    setSelectedAbilities([]);
    updateCharacter({ race, className: "Unassigned", classLevels: {}, statAssignmentComplete: false, raceLocked: false, age: "", height: "", weight: "", startingHpRolled: false, currentHp: 1, maxHp: 1 });
  }

  function toggleAbility(index: number) {
    if (!canEditGeneratedStats || scoresLocked) return;
    setSelectedAbilities((current) => current.includes(index)
      ? current.filter((entry) => entry !== index)
      : current.length < 2 ? [...current, index] : [current[1], index]);
  }

  function swapSelectedScores() {
    if (!canEditGeneratedStats || scoresLocked || selectedAbilities.length !== 2) return;
    const next = [...raw] as OsricStatline;
    const [left, right] = selectedAbilities;
    [next[left], next[right]] = [next[right], next[left]];
    const rawStats = statStrings(next);
    setSelectedAbilities([]);
    updateCharacter({ rawStats, stats: statStrings(finalStatsFromRaw(next, character.race)), className: "Unassigned", classLevels: {}, statAssignmentComplete: false, scoresLocked: false, raceLocked: false, age: "", height: "", weight: "", startingHpRolled: false, currentHp: 1, maxHp: 1, inventoryLines: ensureInventoryLines(character, rawStats[0]) });
  }

  function selectClass(className: string) {
    if (!canEditGeneratedStats || !raceLocked || classLocked || !qualified.includes(className)) return;
    const classLevels = Object.fromEntries(className.split("/").map((name) => [name.trim(), 1]));
    updateCharacter({ className, classLevels, rawStats: statStrings(raw), statAssignmentComplete: false, ...(className === character.className ? {} : { age: "" }), startingHpRolled: false, currentHp: 1, maxHp: 1 });
    setSelectedAbilities([]);
  }

  function lockScores() {
    if (!canEditGeneratedStats || scoresLocked || !window.confirm(`Lock these scores? ${OSRIC_ABILITIES.map((ability, index) => `${ability} ${raw[index]}`).join(" · ")}`)) return;
    setSelectedAbilities([]);
    updateCharacter({ rawStats: statStrings(raw), className: "Unassigned", classLevels: {}, statAssignmentComplete: false, scoresLocked: true, raceLocked: false, age: "", height: "", weight: "", inventoryLines: ensureInventoryLines(character, String(raw[0])) });
  }

  function unlockScores() {
    if (!canEditGeneratedStats || !scoresLocked || raceLocked || !window.confirm("Unlock scores? Race and class selection will be cleared.")) return;
    setSelectedAbilities([]);
    updateCharacter({ className: "Unassigned", classLevels: {}, statAssignmentComplete: false, scoresLocked: false, raceLocked: false, age: "", height: "", weight: "", startingHpRolled: false, currentHp: 1, maxHp: 1 });
  }

  function lockRace() {
    if (!canEditGeneratedStats || !scoresLocked || raceLocked || !selectedAncestry?.qualified || !window.confirm(`Lock ${character.race} as this character's race?`)) return;
    updateCharacter({ className: "Unassigned", classLevels: {}, statAssignmentComplete: false, raceLocked: true });
  }

  function unlockRace() {
    if (!canEditGeneratedStats || !raceLocked || classLocked || !window.confirm("Unlock race? Class selection will be cleared.")) return;
    updateCharacter({ className: "Unassigned", classLevels: {}, statAssignmentComplete: false, raceLocked: false, age: "", height: "", weight: "", startingHpRolled: false, currentHp: 1, maxHp: 1 });
  }

  function lockClass() {
    if (!canEditGeneratedStats || classLocked || !raceLocked || !selectedClassIsLegal || !window.confirm(`Lock ${character.className}? This generates starting age and starting money.`)) return;
    const classLevels = Object.fromEntries(character.className.split("/").map((name) => [name.trim(), 1]));
    updateCharacter({ classLevels, rawStats: statStrings(raw), statAssignmentComplete: true, scoresLocked: true, raceLocked: true, inventoryLines: ensureInventoryLines(character, String(final[0])) });
  }

  function unlockClass() {
    if (!canEditGeneratedStats || !classLocked || !window.confirm("Unlock class selection? Existing starting inventory and age will be preserved.")) return;
    updateCharacter({ statAssignmentComplete: false });
  }

  function rollStartingHp() {
    if (!canEditGeneratedStats || !classLocked) return;
    const verb = character.startingHpRolled ? "Reroll" : "Roll";
    const bonusLabel = constitutionHpBonus === 0 ? "no Constitution adjustment" : `a ${constitutionHpBonus > 0 ? "+" : ""}${constitutionHpBonus} Constitution adjustment per die`;
    if (!window.confirm(`${verb} starting HP from ${character.hitDice} with ${bonusLabel}?${character.startingHpRolled ? " This replaces current and maximum HP." : ""}`)) return;
    const result = rollCharacterHitPoints(character.hitDice, character.stats[2], character.className);
    if (!result) return;
    updateCharacter({ currentHp: result.total, maxHp: result.total, startingHpRolled: true });
  }

  function updateManualScore(index: number, score: number) {
    const rawStats = statStrings(raw);
    rawStats[index] = String(score);
    updateCharacter({
      rawStats,
      stats: statStrings(finalStatsFromRaw(statlineFromStrings(rawStats), character.race)),
      className: "Unassigned",
      classLevels: {},
      statAssignmentComplete: false,
      scoresLocked: false,
      raceLocked: false,
      age: "",
      height: "",
      weight: "",
      startingHpRolled: false,
      currentHp: 1,
      maxHp: 1,
    });
  }

  return (
    <section className="osric-creation-lab">
      <header>
        <div>
          <h3>Character creation</h3>
          <p>Arrange and confirm scores, race, and class in order.</p>
        </div>
        <button type="button" className="primary-button" disabled={!canEditGeneratedStats || scoresLocked} onClick={reroll}>🎲 {pool.length === 6 ? "Reroll 4d6 × 6" : "Roll 4d6 × 6"}</button>
      </header>

      {pool.length === 6 ? (
        <>
          <div className="osric-creation-step"><b>1</b><span><strong>Arrange scores</strong><small>Select two abilities, swap them, then lock the result.</small></span></div>
          <div className="osric-roll-pool" aria-label="Rolled ability score pool">
            {pool.map((score, index) => {
              const dice = character.statRolls?.[index] ?? [];
              const lowest = dice.length ? Math.min(...dice) : null;
              let dropped = false;
              return (
                <span key={index}>
                  <b>{score}</b>
                  {dice.length > 0 && <small>{dice.map((die, dieIndex) => {
                    const drop = !dropped && die === lowest;
                    if (drop) dropped = true;
                    return <i className={drop ? "dropped" : ""} key={dieIndex}>{die}</i>;
                  })}</small>}
                </span>
              );
            })}
          </div>
          <div className="osric-score-allocation" role="group" aria-label="Ability score allocation">
            {OSRIC_ABILITIES.map((ability, index) => <button type="button" disabled={!canEditGeneratedStats || scoresLocked} className={selectedAbilities.includes(index) ? "selected" : ""} aria-pressed={selectedAbilities.includes(index)} onClick={() => toggleAbility(index)} key={ability}><span>{ability}</span><b>{raw[index]}</b></button>)}
          </div>
          <div className="osric-swap-row">
            <span>{selectedAbilities.length === 2 ? `${OSRIC_ABILITIES[selectedAbilities[0]]} ↔ ${OSRIC_ABILITIES[selectedAbilities[1]]}` : selectedAbilities.length === 1 ? `${OSRIC_ABILITIES[selectedAbilities[0]]} selected · choose another ability` : "Choose two ability boxes"}</span>
            <button type="button" disabled={!canEditGeneratedStats || scoresLocked || selectedAbilities.length !== 2} onClick={swapSelectedScores}>Swap selected scores</button>
            {!scoresLocked && <button type="button" className="primary-button" disabled={!canEditGeneratedStats} onClick={lockScores}>Lock scores</button>}
            {scoresLocked && !raceLocked && <button type="button" onClick={unlockScores}>Unlock scores</button>}
          </div>
        </>
      ) : <p className="osric-empty-pool">Roll a pool to see every legal class and its recommended assignment.</p>}

      <details className="osric-manual-entry">
        <summary>{scoresLocked ? "Base scores locked" : "Enter or revise base scores manually"}</summary>
        <div className="osric-manual-stat-grid">
          {raw.map((score, index) => (
            <label key={OSRIC_ABILITIES[index]}>{OSRIC_ABILITIES[index]}
              <FormattedNumberInput ariaLabel={character.name + " " + OSRIC_ABILITIES[index] + " base score"} value={Number(score)} min={3} max={18} readOnly={!canEditGeneratedStats || scoresLocked} onCommit={(value) => updateManualScore(index, value)} />
            </label>
          ))}
        </div>
        <p className="osric-adjustment-note">Ancestry and cumulative age adjustments are applied to these base scores automatically.</p>
      </details>

      {scoresLocked && <section className="osric-current-qualifications osric-race-declaration">
        <div className="osric-creation-step"><b>2</b><span><strong>Choose race</strong><small>Only races allowed by the locked scores can be selected.</small></span></div>
        <div className="osric-subheading"><b>Available races</b><span>{availableAncestries.length} choice{availableAncestries.length === 1 ? "" : "s"}</span></div>
        <div className="osric-ancestry-row" role="group" aria-label="Available OSRIC races">{availableAncestries.map((ancestry) => <button type="button" disabled={raceLocked || !canEditGeneratedStats} className={character.race === ancestry.name ? "active" : ""} onClick={() => chooseAncestry(ancestry.name)} key={ancestry.name}>{ancestry.name}</button>)}</div>
        <p className="osric-adjustment-note">{formatAdjustments(character.race)} · final ancestry limits apply after adjustment.</p>
        <div className="osric-unavailable-options"><b>Unavailable races</b>{unavailableAncestries.map((ancestry) => <p key={ancestry.name}><strong>{ancestry.name}</strong><span>Needs {ancestry.requirements.join(" · ")} after racial adjustments</span></p>)}</div>
        <div className="osric-stage-actions">{!raceLocked ? <button type="button" className="primary-button" disabled={!selectedAncestry?.qualified || !canEditGeneratedStats} onClick={lockRace}>Lock race</button> : !classLocked && <button type="button" onClick={unlockRace}>Unlock race</button>}</div>
      </section>}

      {raceLocked && (
        <section className="osric-current-qualifications osric-class-declaration">
          <div className="osric-creation-step"><b>3</b><span><strong>Choose class</strong><small>Select a legal class line, then lock it.</small></span></div>
          <div className="osric-subheading"><b>Qualified class lines</b><span>{qualified.length} choice{qualified.length === 1 ? "" : "s"}</span></div>
          <div className="osric-qualification-chips">
            {qualified.map((combination) => <button type="button" disabled={classLocked || !canEditGeneratedStats} className={character.className === combination ? "active" : ""} onClick={() => selectClass(combination)} key={combination}>{combination}</button>)}
          </div>
          {qualified.length === 0 && <p className="notice">The current final scores do not meet an allowed {character.race} class.</p>}
          {misses.length > 0 && <details><summary>Closest unavailable classes</summary>{misses.map((miss) => <p key={miss.combination}><b>{miss.combination}</b> · needs {miss.deficits.flatMap((deficit, index) => deficit ? [OSRIC_ABILITIES[index] + " +" + deficit] : []).join(", ")}</p>)}</details>}
          <div className="osric-stage-actions">{!classLocked ? <button type="button" className="primary-button" disabled={!selectedClassIsLegal || !canEditGeneratedStats} onClick={lockClass}>Lock class</button> : <button type="button" onClick={unlockClass}>Unlock class</button>}</div>
        </section>
      )}
      {classLocked && <section className="osric-class-declared osric-generation-results"><span><small>Class locked</small><b>{character.className}</b></span><div><p><b>Starting age:</b> {character.age || "—"}</p><p><b>Starting money:</b> {character.startingInventoryGranted ? "Added to inventory" : "Generating…"}</p></div><div className="osric-age-adjustments"><b>Age adjustments</b>{ageAdjustments.some(Boolean) ? ageAdjustments.flatMap((adjustment, index) => adjustment ? [<span key={OSRIC_ABILITIES[index]}>{OSRIC_ABILITIES[index]} {adjustment > 0 ? "+" : ""}{adjustment}</span>] : []) : <span>None</span>}</div>{character.race.toLowerCase() === "human" && <details><summary>Human dual-class options ({dualClasses.length})</summary>{dualClasses.length ? dualClasses.map((option) => <p key={option.to}>{option.from} → {option.to} · enter with {option.enterPrimes.join(" + ")} 17+</p>) : <p>No automatic dual-class path is available. The old class needs 15+ in every prime requisite and the new class needs 17+.</p>}</details>}</section>}
      {classLocked && <PsionicsGeneration character={character} updateCharacter={updateCharacter} canEdit={canEditGeneratedStats} gmOverride={gmOverride} />}
      {classLocked && <section className="osric-hp-roll-step"><div className="osric-creation-step"><b>4</b><span><strong>Roll hit points</strong><small>{character.hitDice} · CON {character.stats[2]} gives {constitutionHpBonus > 0 ? "+" : ""}{constitutionHpBonus} per die · each adjusted die is at least 1 HP.</small></span></div><span className="osric-hp-result">{character.startingHpRolled ? <><small>Starting HP</small><b>{character.maxHp}</b></> : <small>Final character-setup step</small>}</span><button type="button" className="primary-button" disabled={!canEditGeneratedStats} onClick={rollStartingHp}>{character.startingHpRolled ? "Reroll HP" : "Roll starting HP"}</button></section>}
    </section>
  );
}

function AbilityStrip({ character }: { character: Character }) {
  return (
    <section className="osric-ability-strip" aria-label={character.name + " abilities"}>
      {character.stats.map((score, statIndex) => (
        <button type="button" title={"Roll " + abilityNames[statIndex] + " in Party Chat"} onClick={(event) => sendChatAction({ kind: "ability", characterId: character.id, statIndex, mode: event.ctrlKey ? "value" : event.shiftKey ? "under" : "full" })} key={abilityNames[statIndex]}>
          <span><b>{abilityNames[statIndex]}</b><small>{abilityNames[statIndex] === "STR" ? "Strength" : abilityNames[statIndex] === "DEX" ? "Dexterity" : abilityNames[statIndex] === "CON" ? "Constitution" : abilityNames[statIndex] === "INT" ? "Intelligence" : abilityNames[statIndex] === "WIS" ? "Wisdom" : "Charisma"}</small></span>
          <strong>{statIndex === 0 ? strengthScoreLabel(score, character.exceptionalStrength) : score}</strong>
        </button>
      ))}
    </section>
  );
}

function PsionicsGeneration({ character, updateCharacter, canEdit, gmOverride }: { character: Character; updateCharacter: (patch: Partial<Character>) => void; canEdit: boolean; gmOverride: boolean }) {
  const base = statlineFromStrings(character.rawStats ?? character.stats);
  const [intelligence, wisdom, charisma] = [base[3], base[4], base[5]];
  const eligible = psionicsEligible(intelligence, wisdom, charisma);
  const modifier = psionicPotentialModifier(intelligence, wisdom, charisma);
  const psionics = normalizePsionics(character.psionics);
  const [setupOpen, setSetupOpen] = useState(psionics.determination !== "established");
  const modeLimit = psionics.attackModeRoll ? attackModesKnown(psionics.attackModeRoll) : 0;
  const defenseLimit = psionics.defenseModeRoll ? defenseModesKnown(psionics.defenseModeRoll) : 0;
  const disciplineLimit = psionics.disciplineRoll ? disciplineCounts(psionics.disciplineRoll) : { minor: 0, major: 0 };
  const totalDisciplines = disciplineLimit.minor + disciplineLimit.major;
  const disciplinesAvailableNow = Math.min(totalDisciplines, 1 + Math.floor(Math.max(0, character.level - 1) / 2));
  const classText = character.className.toLowerCase();
  const legalDiscipline = (name: string) => !(psionicDisciplineRules[name].restriction?.toLowerCase().startsWith("magic-user") && /magic-user/.test(classText)) && !(psionicDisciplineRules[name].restriction?.toLowerCase().startsWith("fighters") && /fighter/.test(classText)) && !(psionicDisciplineRules[name].restriction?.toLowerCase().startsWith("thieves") && /thief/.test(classText)) && !(psionicDisciplineRules[name].restriction?.toLowerCase().startsWith("clerics") && /cleric/.test(classText));
  const set = (patch: Partial<typeof psionics>) => updateCharacter({ psionics: normalizePsionics({ ...psionics, ...patch }) });
  const rollPotential = (forced = false) => {
    if (!canEdit || (!eligible && !forced)) return;
    const roll = rollSecureDie(100); const total = roll + modifier; const succeeds = forced || total >= 100;
    if (!succeeds) return set({ enabled: false, determination: "failed", potentialRoll: roll, potentialModifier: modifier, forced: false });
    const strengthRoll = rollSecureDie(100); const strength = strengthRoll + psionicStrengthBonus(intelligence, wisdom, charisma);
    const attackModeRoll = rollSecureDie(100); const defenseModeRoll = rollSecureDie(100); const disciplineRoll = rollSecureDie(100);
    set({ enabled: true, determination: forced ? "forced" : "rolled", forced, potentialRoll: roll, potentialModifier: modifier, psionicStrengthRoll: strengthRoll, psionicStrength: strength, originalPsionicAbility: strength * 2, currentAttackPoints: strength, maxAttackPoints: strength, currentDefensePoints: strength, maxDefensePoints: strength, attackModeRoll, defenseModeRoll, disciplineRoll, attackModes: [], defenseModes: ["Mind Blank"], disciplines: [] });
  };
  const chooseMode = (mode: typeof psionicAttackModes[number], checked: boolean) => { if (!checked && psionics.attackModes.includes(mode)) set({ attackModes: psionics.attackModes.filter((entry) => entry !== mode) }); else if (checked && psionics.attackModes.length < modeLimit) set({ attackModes: [...psionics.attackModes, mode] }); };
  const chooseDefense = (mode: typeof psionicDefenseModes[number], checked: boolean) => { if (mode === "Mind Blank") return; const selected = psionics.defenseModes.filter((entry) => entry !== "Mind Blank"); if (!checked && selected.includes(mode)) set({ defenseModes: ["Mind Blank", ...selected.filter((entry) => entry !== mode)] }); else if (checked && selected.length < Math.max(0, defenseLimit - 1)) set({ defenseModes: ["Mind Blank", ...selected, mode] }); };
  const chooseDiscipline = (name: string, category: "minor" | "major", checked: boolean) => { const selected = psionics.disciplines.filter((entry) => entry.category === category); const limit = category === "minor" ? disciplineLimit.minor : disciplineLimit.major; const total = psionics.disciplines.length; const minorsComplete = psionics.disciplines.filter((entry) => entry.category === "minor").length >= disciplineLimit.minor; if (!checked) return set({ disciplines: psionics.disciplines.filter((entry) => entry.name !== name) }); if (total >= disciplinesAvailableNow || selected.length >= limit || (category === "major" && !minorsComplete) || !legalDiscipline(name)) return; set({ disciplines: [...psionics.disciplines, { id: sharedId(), name, category, masteryLevel: character.level, acquiredLevel: character.level, status: psionicDisciplineRules[name].status }] }); };
  if (!eligible && !gmOverride) return <section className="psionics-generation-step"><div className="osric-creation-step"><b>4</b><span><strong>Psionic potential <PsionicTermInfoButton term="potential" /></strong><small>Not eligible: unmodified INT, WIS, or CHA must be 16+.</small></span></div></section>;
  return <section className="psionics-generation-step">
    <div className="osric-creation-step"><b>4</b><span><strong>Psionic potential <PsionicTermInfoButton term="potential" /></strong><small>INT {intelligence} · WIS {wisdom} · CHA {charisma} · potential modifier +{modifier}</small></span></div>
    {psionics.determination === "unresolved" || psionics.determination === "ineligible" ? <div className="psionics-generation-actions"><button type="button" className="primary-button" disabled={!canEdit || !eligible} onClick={() => rollPotential(false)}>Roll potential</button>{gmOverride && <button type="button" onClick={() => rollPotential(true)}>Force psionic</button>}</div> : !psionics.enabled ? <div className="psionics-generation-result"><span><b>Not psionic</b><small>d100 {psionics.potentialRoll ?? "—"} + {psionics.potentialModifier} = {(psionics.potentialRoll ?? 0) + psionics.potentialModifier}</small></span>{gmOverride && <span><button type="button" onClick={() => set({ determination: "unresolved", potentialRoll: null })}>Reroll potential</button><button type="button" onClick={() => rollPotential(true)}>Force psionic</button></span>}</div> : <div className="psionics-generation-result"><span><b>{psionics.determination === "established" ? "Psionics established" : "Psionic"}</b><small>{psionics.forced ? "GM-forced result" : `Potential d100 ${psionics.potentialRoll} + ${psionics.potentialModifier}`}</small></span><div className="psionic-generation-stats"><span><small>Strength <PsionicTermInfoButton term="strength" /></small><b>{psionics.psionicStrength}</b></span><span><small>Ability <PsionicTermInfoButton term="ability" /></small><b>{psionics.originalPsionicAbility}</b></span><span><small>Attack Points <PsionicTermInfoButton term="attackPoints" /></small><b>{psionics.currentAttackPoints}/{psionics.maxAttackPoints}</b></span><span><small>Defense Points <PsionicTermInfoButton term="defensePoints" /></small><b>{psionics.currentDefensePoints}/{psionics.maxDefensePoints}</b></span></div>{gmOverride && <button type="button" onClick={() => set({ determination: "unresolved", enabled: false, forced: false })}>Reroll psionics</button>}</div>}
    {psionics.enabled && <details className="psionics-generation-editor" open={setupOpen} onToggle={(event) => setSetupOpen(event.currentTarget.open)}>
      <summary><span>{psionics.determination === "established" ? "✓ Psionics established" : "Psionic setup"}</span><small>{psionics.determination === "established" ? "Setup saved · expand to review modes and disciplines" : `Choose ${modeLimit} attacks · ${defenseLimit - 1} additional defenses · ${disciplinesAvailableNow} of ${totalDisciplines} disciplines available at level ${character.level}`}</small></summary>
      <div>
        <div className="psionic-generation-rolls"><span><small>Strength roll <PsionicTermInfoButton term="strength" /></small><b>d100 {psionics.psionicStrengthRoll} + {psionicStrengthBonus(intelligence, wisdom, charisma)} = {psionics.psionicStrength}</b></span><span><small>Attack-mode roll <PsionicTermInfoButton term="attackModes" /></small><b>d100 {psionics.attackModeRoll} → {modeLimit} known</b></span><span><small>Defense-mode roll <PsionicTermInfoButton term="defenseModes" /></small><b>d100 {psionics.defenseModeRoll} → {defenseLimit} known</b></span><span><small>Discipline roll <PsionicTermInfoButton term="disciplines" /></small><b>d100 {psionics.disciplineRoll} → {disciplineLimit.minor} minor / {disciplineLimit.major} major</b></span></div>
        <fieldset><legend>Attack modes <PsionicTermInfoButton term="attackModes" /></legend><div className="psionic-choice-grid">{psionicAttackModes.map((mode) => <div className="psionic-mode-choice" key={mode}><label><input type="checkbox" checked={psionics.attackModes.includes(mode)} disabled={!canEdit || (!psionics.attackModes.includes(mode) && psionics.attackModes.length >= modeLimit)} onChange={(event) => chooseMode(mode, event.target.checked)} /><span>{mode}</span></label><PsionicAttackModeTooltip mode={mode}>ⓘ</PsionicAttackModeTooltip></div>)}</div></fieldset>
        <fieldset><legend>Defense modes <PsionicTermInfoButton term="defenseModes" /></legend><div className="psionic-choice-grid">{psionicDefenseModes.map((mode) => <div className="psionic-mode-choice" key={mode}><label><input type="checkbox" checked={psionics.defenseModes.includes(mode)} disabled={mode === "Mind Blank" || !canEdit || (!psionics.defenseModes.includes(mode) && psionics.defenseModes.filter((entry) => entry !== "Mind Blank").length >= defenseLimit - 1)} onChange={(event) => chooseDefense(mode, event.target.checked)} /><span>{mode}{mode === "Mind Blank" ? " · automatic" : ""}</span></label><PsionicDefenseModeTooltip mode={mode}>ⓘ</PsionicDefenseModeTooltip></div>)}</div></fieldset>
        <fieldset><legend>Minor disciplines <PsionicTermInfoButton term="disciplines" /></legend><div className="psionic-choice-grid disciplines">{minorDisciplineNames.map((name) => <div className="psionic-mode-choice" key={name}><label><input type="checkbox" checked={psionics.disciplines.some((entry) => entry.name === name)} disabled={!canEdit || !legalDiscipline(name) || (!psionics.disciplines.some((entry) => entry.name === name) && (psionics.disciplines.length >= disciplinesAvailableNow || psionics.disciplines.filter((entry) => entry.category === "minor").length >= disciplineLimit.minor))} onChange={(event) => chooseDiscipline(name, "minor", event.target.checked)} /><span>{name}</span></label><PsionicDisciplineTooltip name={name}>ⓘ</PsionicDisciplineTooltip></div>)}</div></fieldset>
        <fieldset><legend>Major disciplines <PsionicTermInfoButton term="disciplines" /></legend><div className="psionic-choice-grid disciplines">{majorDisciplineNames.map((name) => <div className="psionic-mode-choice" key={name}><label><input type="checkbox" checked={psionics.disciplines.some((entry) => entry.name === name)} disabled={!canEdit || !legalDiscipline(name) || (!psionics.disciplines.some((entry) => entry.name === name) && (psionics.disciplines.length >= disciplinesAvailableNow || psionics.disciplines.filter((entry) => entry.category === "minor").length < disciplineLimit.minor || psionics.disciplines.filter((entry) => entry.category === "major").length >= disciplineLimit.major))} onChange={(event) => chooseDiscipline(name, "major", event.target.checked)} /><span>{name}</span></label><PsionicDisciplineTooltip name={name}>ⓘ</PsionicDisciplineTooltip></div>)}</div></fieldset>
        <button type="button" className="primary-button" disabled={psionics.determination === "established" || !canEdit || psionics.attackModes.length !== modeLimit || psionics.defenseModes.length !== defenseLimit || psionics.disciplines.length !== disciplinesAvailableNow} onClick={() => { set({ determination: "established" }); setSetupOpen(false); }}>{psionics.determination === "established" ? "✓ Psionics established" : "Establish psionics"}</button>
      </div>
    </details>}
  </section>;
}

function CharacterSpellbook({ character, updateCharacter }: { character: Character; updateCharacter: (patch: Partial<Character>) => void }) {
  const tracks = getSpellcastingTracks(character);
  const psionics = normalizePsionics(character.psionics);
  if (!tracks.length && !psionics.enabled) return null;
  const ready = character.spellSlots.filter((slot) => !slot.overCapacity && !slot.expended && (slot.spellbookId || slot.preparedSpellName)).length;
  const capacity = tracks.reduce((total, track) => total + track.slots.reduce((sum, value) => sum + value, 0), 0);

  function chooseBookSpell(spellId: string, name: string) {
    const spell = character.spellbook.find((entry) => entry.id === spellId);
    const track = spell && tracks.find((entry) => entry.id === spell.trackId);
    if (!spell || !track) return;
    if (name && character.spellbook.some((entry) => entry.id !== spellId && entry.trackId === spell.trackId && entry.name === name)) return;
    const level = Object.entries(OSRIC_SPELLS[track.tradition]).find(([, names]) => names.includes(name))?.[0];
    const numericLevel = Math.max(1, Number(level) || 1);
    updateCharacter({ spellbook: character.spellbook.map((entry) => entry.id === spellId ? { ...entry, name, level: numericLevel, castingTime: numericLevel } : entry) });
  }

  function updatePsionicPool(pool: "currentAttackPoints" | "currentDefensePoints", value: number) {
    updateCharacter({ psionics: normalizePsionics({ ...psionics, [pool]: value }) });
  }

  function restAndRecoverPsionics() {
    updateCharacter({
      psionics: normalizePsionics({ ...psionics, currentAttackPoints: psionics.maxAttackPoints, currentDefensePoints: psionics.maxDefensePoints }),
    });
  }

  return (
    <details className="character-spell-panel">
      <summary>Spells{psionics.enabled ? " & psionics" : ""} · {tracks.length} track{tracks.length === 1 ? "" : "s"}{tracks.length ? ` · ${ready}/${capacity} ready` : ""}</summary>
      <div className="spell-track-stack">
        {tracks.map((track) => {
          const trackBook = character.spellbook.filter((entry) => entry.trackId === track.id);
          const trackSlots = character.spellSlots.filter((entry) => entry.trackId === track.id);
          const overCapacity = trackSlots.filter((entry) => entry.overCapacity).length;
          return <section className="spell-track" key={track.id}>
            <header className="spell-track-header">
              <span><b>{spellTrackLabel(track)}</b><small>Caster level {track.casterLevel}</small></span>
              <span className="spell-capacity-tiles">{track.slots.map((count, index) => count ? <i title={track.wisdomSlots[index] ? `Base ${track.baseSlots[index]} · Wisdom +${track.wisdomSlots[index]}` : `Class progression: ${count}`} key={index}>L{index + 1} <b>{count}</b></i> : null)}</span>
            </header>
            {track.usesSpellbook && <div className="spellbook-editor">
              <div className="panel-heading split-heading"><div><h3>{track.tradition === "phantasmal" ? "Phantasmal" : "Arcane"} spellbook</h3><p>{trackBook.length} entries · understood spells stay recorded after level loss.</p></div><button type="button" onClick={() => { const maximumSpellLevel = Math.max(1, track.baseSlots.length); updateCharacter({ spellbook: [...character.spellbook, { id: sharedId(), name: "", level: 1, castingTime: 1, text: "", trackId: track.id, understood: false, acquisition: "copied", acquisitionClassLevel: track.classLevel, maximumSpellLevel }] }); }}>+ Copied spell</button></div>
              <div className="spellbook-list">{trackBook.map((spell) => {
                const maximum = Math.max(1, spell.maximumSpellLevel ?? track.baseSlots.length);
                const chosenNames = new Set(trackBook.filter((entry) => entry.id !== spell.id && entry.name).map((entry) => entry.name));
                const options = Object.entries(OSRIC_SPELLS[track.tradition]).flatMap(([level, names]) => Number(level) <= maximum ? names.filter((name) => !chosenNames.has(name)).map((name) => ({ name, level: Number(level) })) : []);
                const readMagicLocked = spell.acquisition === "starting-choice" && spell.name === "Read Magic" && track.tradition === "arcane";
                return <article key={spell.id}>
                  <div className="spellbook-row automated">
                    <span className="spell-acquisition">{spell.acquisition === "starting-random" ? "Random" : spell.acquisition === "starting-choice" ? "Starting choice" : spell.acquisition === "level-up" ? `Level ${spell.acquisitionClassLevel} choice` : "Copied"}<small>up to L{maximum}</small></span>
                    <select aria-label={character.name + " spell choice"} disabled={spell.acquisition === "starting-random" || readMagicLocked} value={spell.name} onChange={(event) => chooseBookSpell(spell.id, event.target.value)}><option value="">Choose spell</option>{options.map((option) => <option value={option.name} key={option.level + ":" + option.name}>L{option.level} · {option.name}</option>)}</select>
                    <label className="spell-casting-time"><span>Casting segments</span><input aria-label={character.name + " spell casting time"} type="number" min="0" value={spell.castingTime} onChange={(event) => updateCharacter({ spellbook: character.spellbook.map((entry) => entry.id === spell.id ? { ...entry, castingTime: Math.max(0, Number(event.target.value) || 0) } : entry) })} /></label>
                    {spell.acquisition === "copied" ? <span className="spellbook-actions"><label><input type="checkbox" checked={spell.understood !== false} onChange={(event) => updateCharacter({ spellbook: character.spellbook.map((entry) => entry.id === spell.id ? { ...entry, understood: event.target.checked } : entry) })} />Understood</label><button className="text-button danger-link" type="button" onClick={() => updateCharacter({ spellbook: character.spellbook.filter((entry) => entry.id !== spell.id), spellSlots: character.spellSlots.map((slot) => slot.spellbookId === spell.id ? { ...slot, spellbookId: null } : slot) })}>Remove</button></span> : <small>{spell.understood ? "Understood" : "Not yet understood"}</small>}
                  </div>
                </article>;
              })}</div>
            </div>}
            <div className="spell-slot-editor">
              <div className="panel-heading split-heading"><div><h3>Preparation</h3><p>{trackSlots.filter((slot) => !slot.overCapacity).length} slots · exact spell levels only{overCapacity ? ` · ${overCapacity} over capacity` : ""}</p></div><button type="button" onClick={() => updateCharacter({ spellSlots: character.spellSlots.map((slot) => slot.trackId === track.id ? { ...slot, expended: false } : slot) })}>Rest and prepare</button></div>
              <div className="spell-slot-list">{trackSlots.map((slot, index) => {
                const bookOptions = trackBook.filter((spell) => spell.level === slot.level && spell.name.trim() && spell.understood !== false);
                const preparedValue = track.usesSpellbook ? slot.spellbookId ?? "" : slot.preparedSpellName ?? "";
                return <div className={slot.overCapacity ? "over-capacity" : ""} key={slot.id}><span>L{slot.level} · {index + 1}</span><select className="prepared-spell-select" aria-label={character.name + " prepared spell"} value={preparedValue} onChange={(event) => updateCharacter({ spellSlots: character.spellSlots.map((entry) => entry.id === slot.id ? track.usesSpellbook ? { ...entry, spellbookId: event.target.value || null, preparedSpellName: null, expended: false } : { ...entry, spellbookId: null, preparedSpellName: event.target.value || null, castingTime: slot.level, expended: false } : entry) })}><option value="">Open</option>{track.usesSpellbook ? bookOptions.map((spell) => <option value={spell.id} key={spell.id}>{spell.name}</option>) : (OSRIC_SPELLS[track.tradition][slot.level] ?? []).map((name) => <option value={name} key={name}>{name}</option>)}</select><small>{slot.overCapacity ? "OVER CAPACITY" : slot.expended ? "Expended" : preparedValue ? `${slot.level} hr` : "Open"}</small></div>;
              })}</div>
            </div>
          </section>;
        })}
        {psionics.enabled && <section className="spell-track psionic-reference-track">
          <header className="spell-track-header"><span><b>Psionic disciplines</b><small>Strength {psionics.psionicStrength} · Ability {psionics.originalPsionicAbility}</small></span><span className="spell-capacity-tiles"><i>ATK <b>{psionics.attackModes.length}</b></i><i>DEF <b>{psionics.defenseModes.length}</b></i></span></header>
          <div className="psionic-recovery-panel panel-heading split-heading">
            <div><h3>Recovery</h3><p>Refresh both point pools after the character completes the required rest.</p></div>
            <button type="button" onClick={restAndRecoverPsionics}>Rest and prepare</button>
          </div>
          <div className="psionic-pool-editor" aria-label={`${character.name} psionic point pools`}>
            <span><small>Current strength <PsionicTermInfoButton term="currentStrength" /></small><b>{psionics.currentAttackPoints + psionics.currentDefensePoints}</b></span>
            <label><span>Attack Points <PsionicTermInfoButton term="attackPoints" /></span><span><HpMathInput value={psionics.currentAttackPoints} minimum={0} maximum={psionics.maxAttackPoints} ariaLabel={`${character.name} current Attack Points`} title="Enter a number to set AP, +number to recover, or -number to spend. The maximum cannot be exceeded." onCommit={(value) => updatePsionicPool("currentAttackPoints", value)} /><small>/ {psionics.maxAttackPoints}</small></span></label>
            <label><span>Defense Points <PsionicTermInfoButton term="defensePoints" /></span><span><HpMathInput value={psionics.currentDefensePoints} minimum={0} maximum={psionics.maxDefensePoints} ariaLabel={`${character.name} current Defense Points`} title="Enter a number to set DP, +number to recover, or -number to spend. The maximum cannot be exceeded." onCommit={(value) => updatePsionicPool("currentDefensePoints", value)} /><small>/ {psionics.maxDefensePoints}</small></span></label>
          </div>
          <div className="psionic-spell-reference"><section><h3>Modes</h3><div className="psionic-known-modes"><span><b>Attack modes</b><span>{psionics.attackModes.length ? psionics.attackModes.map((mode) => <PsionicAttackModeTooltip mode={mode} key={mode}>{mode}</PsionicAttackModeTooltip>) : "None"}</span></span><span><b>Defense modes</b><span>{psionics.defenseModes.length ? psionics.defenseModes.map((mode) => <PsionicDefenseModeTooltip mode={mode} key={mode}>{mode}</PsionicDefenseModeTooltip>) : "Mind Blank"}</span></span></div></section><section><h3>Disciplines</h3>{psionics.disciplines.length ? <div className="spellbook-list">{psionics.disciplines.map((discipline) => { const rule = psionicDisciplineRules[discipline.name]; return <article key={discipline.id}><div className="spellbook-row automated"><span className="spell-acquisition">{discipline.category === "minor" ? "Devotion" : "Science"}<small>Mastery {discipline.masteryLevel}</small></span><span><PsionicDisciplineTooltip name={discipline.name}>{discipline.name}</PsionicDisciplineTooltip><small>{rule.cost} · {rule.duration}{rule.restriction ? ` · ${rule.restriction}` : ""}</small></span><small>{rule.status === "incomplete-source" ? "GM procedure required" : rule.status === "gm-adjudicated" ? "GM adjudication" : rule.summary}</small></div></article>; })}</div> : <p className="compact-empty">No disciplines recorded.</p>}</section></div>
        </section>}
      </div>
      <p className="spell-preparation-total">{spellPreparationHours(character)} total preparation hours</p>
    </details>
  );
}

function WeaponsConfig({ character, updateCharacter, gmOverride = false }: { character: Character; updateCharacter: (patch: Partial<Character>) => void; gmOverride?: boolean }) {
  const capacity = getProficiencyCapacity(character);
  const training = character.weaponTraining ?? [];
  const used = trainingSlotsUsed(training);
  const remaining = capacity - used;
  const legal = getLegalWeaponProficiencies(character);
  const specializationAllowed = canSpecialize(character);

  function setTraining(weaponRulesId: string, proficient: boolean, specialized: boolean) {
    const current = training.find((entry) => entry.weaponRulesId === weaponRulesId);
    if (specialized && !current?.specialized && character.weaponTrainingLocked && !gmOverride) return;
    const nextEntry = { weaponRulesId, proficient: proficient || specialized, specialized, specializationOverride: specialized && gmOverride && !specializationAllowed };
    const next = current
      ? training.map((entry) => entry.weaponRulesId === weaponRulesId ? nextEntry : entry)
      : [...training, nextEntry];
    const compact = next.filter((entry) => entry.proficient || entry.specialized);
    if (trainingSlotsUsed(compact) > capacity && trainingSlotsUsed(compact) > used) return;
    updateCharacter({ weaponTraining: compact });
  }

  return <details className="weapons-config" open>
    <summary><span>Weapons config</span><b>{capacity} slots total · {used} used · {Math.max(0, remaining)} remaining</b></summary>
    {remaining < 0 && <p className="training-over-capacity">{Math.abs(remaining)} proficiency slot{remaining === -1 ? "" : "s"} over limit</p>}
    <div className="weapon-training-list">{legal.map((rules) => {
      const state = training.find((entry) => entry.weaponRulesId === rules.id) ?? { weaponRulesId: rules.id, proficient: false, specialized: false };
      const cost = specializationCost(rules);
      const maySpecialize = specializationAllowed || gmOverride;
      const specializationLocked = character.weaponTrainingLocked && !state.specialized && !gmOverride;
      return <div key={rules.id}><span><b>{rules.name}</b><small>{rules.weaponType === "melee" ? "Melee" : "Missile"}{state.specialized ? ` · ${cost} slots total` : ""}</small></span><label><input type="checkbox" checked={state.proficient || state.specialized} onChange={(event) => setTraining(rules.id, event.target.checked, event.target.checked ? state.specialized : false)} />Proficient</label>{maySpecialize && <label title={specializationLocked ? "New specializations are normally chosen only during character creation" : specializationAllowed ? `Costs ${cost} proficiency slots total` : "GM override specialization"}><input type="checkbox" checked={state.specialized} disabled={specializationLocked} onChange={(event) => setTraining(rules.id, event.target.checked || state.proficient, event.target.checked)} />Specialized</label>}</div>;
    })}</div>
    {!character.weaponTrainingLocked
      ? <button type="button" className="secondary-action" disabled={remaining < 0} onClick={() => updateCharacter({ weaponTrainingLocked: true })}>Finish starting training</button>
      : <p className="training-lock-note">Starting specialization locked{gmOverride ? " · GM override available" : ""}</p>}
  </details>;
}

function WeaponTrainingSummary({ character }: { character: Character }) {
  const selected = (character.weaponTraining ?? []).filter((entry) => entry.proficient || entry.specialized);
  if (!selected.length) return null;
  const used = trainingSlotsUsed(selected);
  const capacity = getProficiencyCapacity(character);
  return <details className="weapon-training-summary"><summary>Weapons · {used}/{capacity} proficiency slots</summary><div>{selected.map((entry) => {
    const rules = weaponRulesById(entry.weaponRulesId);
    return rules ? <span key={entry.weaponRulesId}><b>{rules.name}</b><small>{entry.specialized ? "Specialized" : "Proficient"}</small></span> : null;
  })}</div>{used > capacity && <p className="training-over-capacity">{used - capacity} proficiency slot{used - capacity === 1 ? "" : "s"} over limit</p>}</details>;
}

function AncestralAbilitiesPanel({ character, canEdit, updateCharacter }: { character: Character; canEdit: boolean; updateCharacter: (patch: Partial<Character>) => void }) {
  const abilities = abilitiesForAncestry(character.race);
  return <details className="ancestral-abilities-panel">
    <summary>Abilities · {character.race}</summary>
    <div className="ancestral-abilities-body">
      {abilities.length ? <div className="ancestral-ability-list">{abilities.map((ability) => <article key={ability.name}>
        <h4>{ability.name}</h4>
        <p>{ability.description}</p>
        {ability.rows && <dl>{ability.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      </article>)}</div> : <p className="compact-empty">No standard ancestry abilities.</p>}
      <label className="ancestral-ability-notes">Additional abilities or notes<textarea aria-label={`${character.name} additional abilities`} readOnly={!canEdit} value={character.abilityNotes ?? ""} placeholder="Add campaign, class, or earned abilities…" onChange={(event) => updateCharacter({ abilityNotes: event.target.value })} /></label>
    </div>
  </details>;
}

export default function CharacterSheetPanel(props: CharacterSheetPanelProps) {
  const { campaign, setCampaign, characters, expandedCharacterIds, setExpandedCharacterIds, emojiPickerFor, setEmojiPickerFor, updateCharacter, addCharacter, moveCharacter, toggleCharacterExpanded, removeCharacter, restoreDiscardedCharacter, toggleMissionCharacter, createCharacterCampaign, renameCharacterCampaign, deleteCharacterCampaign } = props;
  const [mode, setMode] = useState<"play" | "setup">(() => {
    if (typeof window === "undefined") return "play";
    try { return window.sessionStorage.getItem("adnd-character-sheet-mode") === "setup" ? "setup" : "play"; } catch { return "play"; }
  });
  const [viewerRole, setViewerRole] = useState<PartyChatRole | null>(null);
  const [viewerDockedCharacterIds, setViewerDockedCharacterIds] = useState<string[]>([]);
  const [folderOpenById, setFolderOpenById] = useState<Record<string, boolean>>({});
  const [folderViewReadyFor, setFolderViewReadyFor] = useState("");
  const canManageCampaigns = partyChatRoleHasGmPermissions(viewerRole);
  const canGenerateCharacters = partyChatRoleCanGenerateCharacters(viewerRole);

  useEffect(() => {
    const readRole = (detail?: unknown) => {
      try {
        const stored = detail && typeof detail === "object"
          ? detail
          : JSON.parse(window.localStorage.getItem(PARTY_CHAT_PREFERENCES_KEY) || "{}");
        const preferences = stored as { role?: PartyChatRole; gmRole?: boolean; dockedIds?: string[] };
        setViewerRole(partyChatRoleFromPreferences(preferences));
        setViewerDockedCharacterIds(Array.isArray(preferences.dockedIds) ? preferences.dockedIds.filter((entry): entry is string => typeof entry === "string") : []);
      } catch { setViewerRole(null); setViewerDockedCharacterIds([]); }
    };
    readRole();
    const changed = (event: Event) => readRole((event as CustomEvent).detail);
    window.addEventListener("adnd-role-change", changed);
    return () => window.removeEventListener("adnd-role-change", changed);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(`adnd-character-folder-view:${campaign.activeCharacterCampaignId}`) || "{}") as Record<string, unknown>;
        setFolderOpenById(Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")));
      } catch { setFolderOpenById({}); }
      setFolderViewReadyFor(campaign.activeCharacterCampaignId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [campaign.activeCharacterCampaignId]);

  useEffect(() => {
    if (folderViewReadyFor !== campaign.activeCharacterCampaignId) return;
    try { window.localStorage.setItem(`adnd-character-folder-view:${campaign.activeCharacterCampaignId}`, JSON.stringify(folderOpenById)); } catch {}
  }, [campaign.activeCharacterCampaignId, folderOpenById, folderViewReadyFor]);

  function changeMode(next: "play" | "setup") {
    setMode(next);
    try { window.sessionStorage.setItem("adnd-character-sheet-mode", next); } catch {}
  }

  function update(character: Character, patch: Partial<Character>) {
    updateCharacter(character.id, patch);
  }

  function restoreDiscardedStableNpc(discardId: string) {
    if (!canManageCampaigns) return;
    setCampaign((current) => {
      const discard = current.discardedStableNpcs.find((entry) => entry.id === discardId);
      if (!discard || current.stableNpcs.some((entry) => entry.id === discard.npc.id)) return current;
      const restored = discard.inventoryDiscardId ? restoreInventoryDiscard(current.inventoryManagement, discard.inventoryDiscardId) : null;
      return {
        ...current,
        stableNpcs: [...current.stableNpcs, discard.npc],
        discardedStableNpcs: current.discardedStableNpcs.filter((entry) => entry.id !== discardId),
        inventoryManagement: restored?.restored ? restored.state : addStableNpcInventory(current.inventoryManagement, discard.npc),
      };
    });
  }

  function clearDiscard() {
    if (!canManageCampaigns || !window.confirm("Permanently clear every discarded character and Stable NPC?")) return;
    setCampaign((current) => {
      const inventoryDiscardIds = new Set(current.discardedStableNpcs.flatMap((entry) => entry.inventoryDiscardId ? [entry.inventoryDiscardId] : []));
      return {
        ...current,
        discardedCharacters: [],
        discardedStableNpcs: [],
        inventoryManagement: { ...current.inventoryManagement, discarded: current.inventoryManagement.discarded.filter((entry) => !inventoryDiscardIds.has(entry.id)) },
      };
    });
  }

  const activeFolders = campaign.characterFolders.filter((folder) => folder.campaignId === campaign.activeCharacterCampaignId);
  const validFolderIds = new Set(activeFolders.map((folder) => folder.id));
  const folderGroups = [
    ...activeFolders.map((folder) => ({ id: folder.id, folder, characters: characters.filter((character) => character.folderId === folder.id) })),
    { id: "unfiled", folder: null, characters: characters.filter((character) => !character.folderId || !validFolderIds.has(character.folderId)) },
  ].filter((group) => group.folder || group.characters.length > 0);

  function folderStartsOpen(folderCharacters: Character[]) {
    return characterFolderStartsOpen(viewerRole, viewerDockedCharacterIds, folderCharacters.map((character) => character.id));
  }

  function folderIsOpen(folderId: string, folderCharacters: Character[]) {
    return folderOpenById[folderId] ?? folderStartsOpen(folderCharacters);
  }

  function toggleFolder(folderId: string, folderCharacters: Character[]) {
    setFolderOpenById((current) => ({ ...current, [folderId]: !(current[folderId] ?? folderStartsOpen(folderCharacters)) }));
  }

  function addFolder() {
    const folderNumber = activeFolders.length + 1;
    setCampaign((current) => ({
      ...current,
      characterFolders: [...current.characterFolders, { id: sharedId(), campaignId: current.activeCharacterCampaignId, name: `Folder ${folderNumber}`, color: "#667085" }],
    }));
  }

  function updateFolder(folderId: string, patch: { name?: string; color?: string }) {
    setCampaign((current) => ({ ...current, characterFolders: current.characterFolders.map((folder) => folder.id === folderId ? { ...folder, ...patch } : folder) }));
  }

  function deleteFolder(folderId: string) {
    if (characters.some((character) => character.folderId === folderId)) return;
    setCampaign((current) => ({ ...current, characterFolders: current.characterFolders.filter((folder) => folder.id !== folderId) }));
    setFolderOpenById((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== folderId)));
  }

  return (
    <section className={"section-stack osric-character-workspace " + (mode === "setup" ? "setup-mode" : "play-mode")}>
      <nav className="character-campaign-bar osric-character-toolbar" aria-label="Character sheet controls">
        <label title={canManageCampaigns ? undefined : "Only the GM or Solo role can switch campaigns"}>Campaign<select value={campaign.activeCharacterCampaignId} disabled={!canManageCampaigns} onChange={(event) => { setCampaign((current) => ({ ...current, activeCharacterCampaignId: event.target.value, partyFund: current.partyFundsByCampaign[event.target.value] ?? 0 })); setExpandedCharacterIds([]); setEmojiPickerFor(null); }}>{campaign.characterCampaigns.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label>
        <div className="osric-mode-switch" aria-label="Character tab mode">
          <button type="button" className={mode === "play" ? "active" : ""} aria-pressed={mode === "play"} onClick={() => changeMode("play")}>Play</button>
          <button type="button" className={mode === "setup" ? "active" : ""} aria-pressed={mode === "setup"} onClick={() => changeMode("setup")}>Edit / Setup</button>
        </div>
        {mode === "setup" && <div className="osric-setup-actions">{canManageCampaigns && <><button onClick={createCharacterCampaign}>New campaign</button><button className="text-button" onClick={renameCharacterCampaign}>Rename</button><button className="text-button danger-link" onClick={deleteCharacterCampaign}>Delete</button><button type="button" onClick={addFolder}>+ Folder</button></>}<button className="primary-button" onClick={addCharacter}>+ New character</button></div>}
      </nav>

      {characters.length === 0 && activeFolders.length === 0 ? <div className="empty-state"><h3>No characters yet</h3><p>Build the first character from a rolled 4d6 pool.</p><button className="primary-button" onClick={() => { changeMode("setup"); addCharacter(); }}>Set up first character</button></div> : (
        <div className="character-list osric-character-list">
          {folderGroups.map((folderGroup) => {
            const folderOpen = folderIsOpen(folderGroup.id, folderGroup.characters);
            return <section className={`character-folder ${folderOpen ? "open" : "collapsed"}`} style={{ "--folder-color": folderGroup.folder?.color ?? "#667085" } as CSSProperties} key={folderGroup.id}>
              <header className="character-folder-header">
                <button type="button" aria-expanded={folderOpen} onClick={() => toggleFolder(folderGroup.id, folderGroup.characters)}><span>{folderOpen ? "▾" : "▸"}</span><b>{folderGroup.folder?.name || "Unfiled"}</b><small>{folderGroup.characters.length} character{folderGroup.characters.length === 1 ? "" : "s"}</small><i className="disclosure-state-word">{folderOpen ? "Collapse" : "Expand"}</i></button>
                {mode === "setup" && canManageCampaigns && folderGroup.folder && <div className="character-folder-settings"><input aria-label="Folder name" maxLength={60} value={folderGroup.folder.name} onChange={(event) => updateFolder(folderGroup.id, { name: event.target.value })} /><DeferredColorEditor compact label={`${folderGroup.folder.name} folder color`} value={folderGroup.folder.color} onApply={(color) => updateFolder(folderGroup.id, { color })} /><button type="button" className="danger-link" disabled={folderGroup.characters.length > 0} title={folderGroup.characters.length > 0 ? "Move every character out before deleting this folder" : undefined} onClick={() => deleteFolder(folderGroup.id)}>Delete</button></div>}
              </header>
              {folderOpen && <div className="character-folder-contents">{folderGroup.characters.map((character) => {
            const characterIndex = characters.indexOf(character);
            const expanded = expandedCharacterIds.includes(character.id);
            const onMission = campaign.missionCharacterIds.includes(character.id);
            const canEditCharacterInventory = canManageCampaigns || (viewerRole === "party-member" && viewerDockedCharacterIds.includes(character.id));
            return (
              <article id={"character-sheet-" + character.id} className={"character-card osric-character-card " + (expanded ? "expanded" : "collapsed")} style={characterTileStyle(character.tileColor)} key={character.id}>
                <header className="osric-sheet-header clickable-card-header" onClick={(event) => { if ((event.target as HTMLElement).closest("button, input, select, textarea, label, details, summary, a")) return; toggleCharacterExpanded(character.id); }}>
                  <div className="osric-character-identity">
                    {mode === "setup" ? <button className="character-emoji-button" aria-label={"Choose emoji for " + character.name} onClick={() => setEmojiPickerFor(emojiPickerFor === character.id ? null : character.id)}>{character.emoji}</button> : <span className="osric-character-emoji">{character.emoji}</span>}
                    <div>
                      {mode === "setup" ? <input className="character-name" aria-label="Character name" value={character.name} onChange={(event) => update(character, { name: event.target.value })} /> : <h2>{character.name}</h2>}
                      <p>{character.race} · {classComponents(character).map((component) => `${component.className} ${component.level}`).join(" / ")} · {character.alignment ?? "True Neutral"} · {character.player || "No player assigned"}</p>
                    </div>
                  </div>
                  <div className="osric-summary-state">
                    <span><small>HP</small><b>{character.currentHp}/{character.maxHp}</b></span>
                    <span><small>AC</small><b>{character.armorClass}</b></span>
                    <span><small>Move</small><b>{movementSummary(effectiveArmorMovementRate(campaign, character)).rate}</b></span>
                    <span><small>XP</small><b>{character.currentXp.toLocaleString("en-US")}</b></span>
                  </div>
                  <div className="osric-card-actions">
                    {mode === "setup" && <><label className="character-folder-picker">Folder<select aria-label={`Move ${character.name} to folder`} disabled={!canEditCharacterInventory} value={character.folderId && validFolderIds.has(character.folderId) ? character.folderId : ""} onChange={(event) => update(character, { folderId: event.target.value || null })}><option value="">Unfiled</option>{activeFolders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label><span className="character-order-actions"><button aria-label={"Move " + character.name + " up"} disabled={characterIndex === 0} onClick={() => moveCharacter(character.id, -1)}>↑</button><button aria-label={"Move " + character.name + " down"} disabled={characterIndex === characters.length - 1} onClick={() => moveCharacter(character.id, 1)}>↓</button></span></>}
                    <button className={onMission ? "mission-status-button active" : "mission-status-button"} onClick={() => toggleMissionCharacter(character.id)}>{onMission ? "Active" : "Standby"}</button>
                    <button className="character-expand-button" aria-expanded={expanded} onClick={() => toggleCharacterExpanded(character.id)}>{expanded ? "Collapse" : "Expand"}</button>
                  </div>
                </header>
                <div className="osric-summary-health"><HpBar current={character.currentHp} maximum={character.maxHp} /></div>

                {emojiPickerFor === character.id && mode === "setup" && <div className="emoji-picker-wrap"><EmojiPicker width="100%" height={420} lazyLoadEmojis searchPlaceHolder="Search all emoji" onEmojiClick={(emojiData) => { update(character, { emoji: emojiData.emoji }); setEmojiPickerFor(null); }} /></div>}

                {expanded && (
                  <div className="osric-sheet-body">
                    <section className="osric-play-state">
                      <div className="osric-vitals">
                        <label>Current HP<HpMathInput ariaLabel={character.name + " current HP"} value={character.currentHp} minimum={-10} onCommit={(currentHp) => update(character, { currentHp })} /></label>
                        <label>Maximum HP<span>{character.maxHp}</span></label>
                        <label>To Hit<span>{character.toHit >= 0 ? "+" + character.toHit : character.toHit}</span></label>
                        <label>Armor Class{canManageCampaigns ? <FormattedNumberInput ariaLabel={character.name + " armor class"} value={character.armorClass} onCommit={(armorClass) => update(character, { armorClass, armorClassOverride: armorClass })} /> : <span>{character.armorClass}</span>}</label>
                        <label>Hit Dice<span>{character.hitDice}</span></label>
                        <label>Current XP<FormattedNumberInput ariaLabel={character.name + " current XP"} value={character.currentXp} min={0} onCommit={(currentXp) => update(character, { currentXp: Math.trunc(currentXp) })} /></label>
                        <label>Next Level<span>{character.totalXp ? character.totalXp.toLocaleString("en-US") : "—"}</span></label>
                      </div>
                      <AbilityStrip character={character} />
                      <div className="osric-record-grid">
                        <section className="osric-save-block"><h3>Saving Throws</h3>{saveFields.map(([key, label, icon]) => <button type="button" title={"Roll " + label + " in Party Chat"} onClick={() => sendChatAction({ kind: "save", characterId: character.id, save: key, label, mode: "roll" })} key={key}><span>{icon} {label}</span><b>{character.saves[key]}</b></button>)}</section>
                        <section className="osric-notes-block"><h3>Character Notes</h3>{character.notes.trim() ? <p>{character.notes}</p> : <p className="compact-empty">No notes recorded.</p>}</section>
                      </div>
                    </section>

                    <CharacterInventoryPanel campaign={campaign} setCampaign={setCampaign} character={character} canEdit={canEditCharacterInventory} />

                    {mode === "setup" && (
                      <section className="osric-setup-sheet">
                        <CharacterCreationLab character={character} canEditGeneratedStats={canGenerateCharacters} gmOverride={canManageCampaigns} updateCharacter={(patch) => update(character, patch)} />
                        {character.className !== "Unassigned" && character.statAssignmentComplete !== false && <WeaponsConfig character={character} gmOverride={canManageCampaigns} updateCharacter={(patch) => update(character, patch)} />}
                        <div className="osric-setup-grid">
                          <fieldset><legend>Identity</legend><label>Player<input value={character.player} onChange={(event) => update(character, { player: event.target.value })} /></label><label>Alignment<select aria-label={character.name + " alignment"} value={character.alignment ?? "True Neutral"} onChange={(event) => update(character, { alignment: event.target.value as NonNullable<Character["alignment"]> })}>{PLAYER_ALIGNMENTS.map((alignment) => <option value={alignment} key={alignment}>{alignment}</option>)}</select></label><label>Class line<span className="osric-derived-field">{character.className}<small>Declared in Character creation above</small></span></label><div className="class-level-fields">{classComponents(character).map((component) => <label key={component.className}>{component.className} level<FormattedNumberInput ariaLabel={character.name + " " + component.className + " level"} value={component.level} min={1} onCommit={(level) => { const classLevels = { ...(character.classLevels ?? {}), [component.className]: Math.max(1, Math.floor(level)) }; update(character, { classLevels, level: Math.max(...Object.values(classLevels)) }); }} /></label>)}</div><div className="character-measurements"><label>Age<FormattedNumberInput ariaLabel={character.name + " age"} value={Number.parseInt(character.age, 10) || 0} min={0} readOnly={character.statAssignmentComplete !== false && !canManageCampaigns} onCommit={(age) => update(character, { age: String(age) })} /></label><label>Height<input value={character.height} onChange={(event) => update(character, { height: event.target.value })} /></label><label>Weight<input value={character.weight} onChange={(event) => update(character, { weight: event.target.value })} /></label></div></fieldset>
                          <fieldset><legend>Base combat record</legend><small>Class and level values update automatically.</small><label>To-hit bonus<FormattedNumberInput ariaLabel={character.name + " to-hit bonus"} value={character.toHit} readOnly={!canManageCampaigns} onCommit={(toHit) => update(character, { toHit })} /></label><label>Ascending AC<span className="armor-class-edit"><FormattedNumberInput ariaLabel={character.name + " ascending AC"} value={character.armorClass} readOnly={!canManageCampaigns} onCommit={(armorClass) => update(character, { armorClass, armorClassOverride: armorClass })} />{canManageCampaigns && character.armorClassOverride !== null && character.armorClassOverride !== undefined && <button type="button" className="secondary-button" onClick={() => update(character, { armorClassOverride: null })}>Use equipment</button>}</span></label><label>Maximum HP<HpMathInput ariaLabel={character.name + " maximum HP"} value={character.maxHp} minimum={0} onCommit={(maxHp) => update(character, { maxHp })} /></label><label>Hit dice<input value={character.hitDice} readOnly={!canManageCampaigns} onChange={(event) => update(character, { hitDice: event.target.value })} /></label><label>Base movement rate<FormattedNumberInput ariaLabel={character.name + " base movement rate"} value={movementSummary(character.movementRate).rate} min={0} onCommit={(movementRate) => update(character, { movementRate })} /><small>Worn armour caps the effective rate automatically.</small></label><label>XP to next<FormattedNumberInput ariaLabel={character.name + " XP to next level"} value={character.totalXp} min={0} readOnly={!canManageCampaigns} onCommit={(totalXp) => update(character, { totalXp: Math.trunc(totalXp) })} /></label></fieldset>
                          <fieldset><legend>Saving throws</legend><small>Best class table by category; ancestry resilience included.</small>{saveFields.map(([key, label, icon]) => <label key={key}><span>{icon} {label}</span><FormattedNumberInput ariaLabel={character.name + " " + label + " save"} value={character.saves[key]} min={1} readOnly={!canManageCampaigns} onCommit={(value) => update(character, { saves: { ...character.saves, [key]: value } })} /></label>)}</fieldset>
                          <fieldset><legend>Notes</legend><label>Notes<textarea value={character.notes} onChange={(event) => update(character, { notes: event.target.value })} /></label></fieldset>
                        </div>
                        <details className="osric-appearance-settings"><summary>Appearance, tile color, macros &amp; removal</summary><DeferredColorEditor label={character.name + " tile color"} value={character.tileColor} onApply={(tileColor) => update(character, { tileColor })} /><div className="macro-editor-grid">{character.diceMacros.map((macro, macroIndex) => <label key={macroIndex}>Macro {macroIndex + 1}<span><input maxLength={10} value={macro.name} onChange={(event) => { const diceMacros = [...character.diceMacros] as Character["diceMacros"]; diceMacros[macroIndex] = { ...macro, name: event.target.value.slice(0, 10) }; update(character, { diceMacros }); }} /><input value={macro.expression} placeholder="2d6+3" onChange={(event) => { const diceMacros = [...character.diceMacros] as Character["diceMacros"]; diceMacros[macroIndex] = { ...macro, expression: event.target.value }; update(character, { diceMacros }); }} /></span></label>)}</div><button className="danger-link" onClick={() => removeCharacter(character.id)}>Move character to discard</button></details>
                      </section>
                    )}

                    {character.statAssignmentComplete !== false && <div className="character-rules-row"><AncestralAbilitiesPanel character={character} canEdit={canEditCharacterInventory} updateCharacter={(patch) => update(character, patch)} /><WeaponTrainingSummary character={character} /></div>}
                    {character.statAssignmentComplete !== false && <CharacterSpellbook character={character} updateCharacter={(patch) => update(character, patch)} />}
                    <details className="character-stat-panel"><summary>Ability details &amp; chat rolls</summary><div className="derived-stat-groups">{character.stats.map((score, statIndex) => <section key={abilityNames[statIndex]}><button className="derived-stat-heading" onClick={(event) => sendChatAction({ kind: "ability", characterId: character.id, statIndex, mode: event.ctrlKey ? "value" : event.shiftKey ? "under" : "full" })}><span>{abilityNames[statIndex]}</span><b>{statIndex === 0 ? strengthScoreLabel(score, character.exceptionalStrength) : score}</b></button><div>{derivedAbilityItems(statIndex, score, statIndex === 0 ? character.exceptionalStrength : null).map((item) => <button key={item.key} onClick={() => sendChatAction({ kind: "derived", characterId: character.id, statIndex, key: item.key })}><span>{item.label}</span><b>{item.value}</b></button>)}</div></section>)}</div></details>
                  </div>
                )}
              </article>
            );
          })}</div>}
            </section>;
          })}
        </div>
      )}

      {mode === "setup" && <details className="panel character-discard-panel"><summary>Character &amp; NPC discard ({campaign.discardedCharacters.length + campaign.discardedStableNpcs.length})</summary><div className="discard-actions"><p>Removed characters and Stable NPCs remain recoverable here.</p><button className="text-button danger-link" disabled={!canManageCampaigns || campaign.discardedCharacters.length + campaign.discardedStableNpcs.length === 0} onClick={clearDiscard}>Clear discard</button></div>{campaign.discardedCharacters.length + campaign.discardedStableNpcs.length === 0 ? <p className="compact-empty">Nothing discarded.</p> : <>{campaign.discardedCharacters.map((discard) => <div className="discard-line character-discard-line" key={discard.id}><span><b>{discard.character.emoji} {discard.character.name}</b><small>{discard.character.className} {discard.character.level} · {discard.character.race}</small></span><button className="text-button" onClick={() => restoreDiscardedCharacter(discard.id)}>Restore</button></div>)}{campaign.discardedStableNpcs.map((discard) => <div className="discard-line character-discard-line" key={discard.id}><span><b>{discard.npc.token} · {discard.npc.name}</b><small>NPC Stable{discard.inventoryDiscardId ? " · inventory retained" : ""}</small></span><button className="text-button" disabled={!canManageCampaigns} onClick={() => restoreDiscardedStableNpc(discard.id)}>Restore</button></div>)}</>}</details>}
    </section>
  );
}
