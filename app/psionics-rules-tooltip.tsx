"use client";

import type { ReactNode } from "react";
import type { PsionicAttackMode, PsionicDefenseMode } from "./types";
import { psionicAttackRules, psionicDefenseRules, psionicDisciplineRules } from "./psionics";
import { RulesPopoverButton } from "./weapon-rules-tooltip";

function rangeLabel(range: [number, number | null, number | null]) {
  return range.map((value) => value === null ? "—" : `${value} in. / ${value * 10} ft`).join(" · ");
}

function RuleRows({ children }: { children: ReactNode }) {
  return <dl className="psionic-rule-rows">{children}</dl>;
}

export function PsionicAttackModeTooltip({ mode, children }: { mode: PsionicAttackMode; children?: ReactNode }) {
  const rule = psionicAttackRules[mode];
  return <RulesPopoverButton className="psionic-rule-trigger" label={`${mode} psionic attack rules`} panel={<div className="psionic-rules-card">
    <strong>{mode}</strong>
    <p>{rule.summary}</p>
    <RuleRows>
      <div><dt>Cost</dt><dd>{rule.cost} Attack Points per exchange</dd></div>
      <div><dt>Range S · M · L</dt><dd>{rangeLabel(rule.range)}</dd></div>
      <div><dt>Area</dt><dd>{rule.area}</dd></div>
      <div><dt>Targets</dt><dd>{rule.canTargetNonPsionic ? "Psionic or non-psionic" : "Psionically aware only"}</dd></div>
      <div><dt>Matrix profile</dt><dd>{rule.matrixProfile}</dd></div>
    </RuleRows>
    {rule.special && <small>{rule.special}</small>}
    <small>Medium-range numerical loss is reduced 20%. Long range lowers the attacker one strength band and reduces loss 20%; at the 01–25 band, reduce it 50%.</small>
  </div>}>{children ?? <span>{mode}<i aria-hidden>ⓘ</i></span>}</RulesPopoverButton>;
}

export function PsionicDefenseModeTooltip({ mode, children }: { mode: PsionicDefenseMode; children?: ReactNode }) {
  const rule = psionicDefenseRules[mode];
  return <RulesPopoverButton className="psionic-rule-trigger" label={`${mode} psionic defense rules`} panel={<div className="psionic-rules-card">
    <strong>{mode}</strong>
    <p>{rule.summary}</p>
    <RuleRows>
      <div><dt>Cost</dt><dd>{rule.cost} Defense Point{rule.cost === 1 ? "" : "s"} per exchange</dd></div>
      <div><dt>Protection</dt><dd>{rule.area}</dd></div>
      <div><dt>Matrix profile</dt><dd>{rule.matrixProfile}</dd></div>
    </RuleRows>
    {rule.special && <small>{rule.special}</small>}
    <small>A defense is raised automatically when possible. At 0 DP the combatant is defenseless and attacks use the defenseless table.</small>
  </div>}>{children ?? <span>{mode}<i aria-hidden>ⓘ</i></span>}</RulesPopoverButton>;
}

export function PsionicDisciplineTooltip({ name, children }: { name: string; children?: ReactNode }) {
  const rule = psionicDisciplineRules[name];
  if (!rule) return <>{children ?? name}</>;
  return <RulesPopoverButton className="psionic-rule-trigger" label={`${name} psionic discipline rules`} panel={<div className="psionic-rules-card">
    <strong>{name}</strong>
    <p>{rule.summary}</p>
    <RuleRows>
      <div><dt>Type</dt><dd>{rule.category === "minor" ? "Minor devotion" : "Major science"}</dd></div>
      <div><dt>Cost</dt><dd>{rule.cost} Strength Points</dd></div>
      <div><dt>Duration</dt><dd>{rule.duration}</dd></div>
      <div><dt>Automation</dt><dd>{rule.status === "reference" ? "Rules reference" : rule.status === "incomplete-source" ? "Incomplete source; GM procedure required" : "GM adjudicated"}</dd></div>
      {rule.restriction && <div><dt>Restriction</dt><dd>{rule.restriction}</dd></div>}
    </RuleRows>
    <small>Each Strength Point spent on a discipline reduces both current AP and current DP by 1.</small>
  </div>}>{children ?? <span>{name}<i aria-hidden>ⓘ</i></span>}</RulesPopoverButton>;
}

const termHelp = {
  potential: ["Psionic potential", "A one-time d100 test available when unmodified INT, WIS, or CHA is 16+. Add +2.5 per INT point, +1.5 per WIS point, and +0.5 per CHA point above 16; total fractions are discarded. A final result of 100+ succeeds."],
  strength: ["Psionic Strength", "Roll d100, then add points above 12 in INT, WIS, and CHA. Multiply that mental bonus by ×2 when two scores exceed 16 or ×4 when all three do. This rating sets each maximum point pool."],
  ability: ["Original Psionic Ability", "Twice Psionic Strength: maximum Attack Points plus maximum Defense Points. The defenseless combat table uses this original value, not the character's depleted current total."],
  attackPoints: ["Attack Points (AP)", "Attack modes spend AP. Current AP also determines the attacker's row on the defenseless table. Numerical defenseless loss first removes AP; any excess becomes ordinary HP damage."],
  defensePoints: ["Defense Points (DP)", "Defense modes spend DP and normal matrix results remove DP. At 0 DP, later attacks use the defenseless table."],
  currentStrength: ["Current Total Psionic Strength", "Current AP + current DP at the start of the segment. This total selects the normal combat matrix band; it is recalculated after each simultaneous exchange."],
  attackModes: ["Attack modes known", "The d100 roll determines how many modes the character may select. Each attack costs AP once per exchange; area attacks do not charge once per target."],
  defenseModes: ["Defense modes known", "The d100 roll determines the total known, including automatic Mind Blank. When attacked, the most favorable affordable defense is raised unless the GM deliberately selects another."],
  disciplines: ["Disciplines", "The d100 roll establishes the character's lifetime minor and major allotment. The character begins with one minor devotion and gains one additional discipline for every two added experience levels, acquiring all minors before majors."],
  range: ["Psionic attack range", "The selected band is the target's actual distance. Medium range reduces numerical loss 20%. Long range lowers the attacker's matrix strength by one band and reduces loss 20%; attacks already in the 01–25 band instead lose 50%."],
  segments: ["Psionic exchange segments", "Psionic combat is independent of ordinary initiative: one simultaneous mental exchange occurs in every selected segment, up to ten in a melee round. Choose the last segment the combatant intends to remain engaged through."],
} as const;

export type PsionicTerm = keyof typeof termHelp;

export function PsionicTermInfoButton({ term }: { term: PsionicTerm }) {
  const [title, description] = termHelp[term];
  return <RulesPopoverButton className="psionic-info-trigger" label={`${title} explanation`} panel={<div className="psionic-rules-card term-card"><strong>{title}</strong><p>{description}</p></div>}>ⓘ</RulesPopoverButton>;
}
