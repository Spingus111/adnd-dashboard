import type { CombatEffect } from "./types";

export type ConditionRule = {
  attack: number;
  armorClass: number;
  saves: number;
  damage: number;
  disablesShieldAndDexterity: boolean;
  helpless: boolean;
  cannotAct: boolean;
  cannotAttack: boolean;
};

const emptyRule: ConditionRule = {
  attack: 0,
  armorClass: 0,
  saves: 0,
  damage: 0,
  disablesShieldAndDexterity: false,
  helpless: false,
  cannotAct: false,
  cannotAttack: false,
};

function activeNames(effects: CombatEffect[]) {
  return new Set(effects.filter((effect) => effect.remainingRounds > 0).map((effect) => effect.name.toLowerCase()));
}

export function combatConditionRule(effects: CombatEffect[]): ConditionRule {
  const names = activeNames(effects);
  const rule = { ...emptyRule };
  if (names.has("bless")) rule.attack += 1;
  if (names.has("curse")) rule.attack -= 1;
  if (names.has("prayer")) {
    rule.attack += 1;
    rule.damage += 1;
    rule.saves += 1;
  }
  if (names.has("blinded")) {
    rule.attack -= 4;
    rule.armorClass -= 4;
    rule.saves -= 4;
  }
  if (names.has("invisible")) {
    rule.armorClass += 4;
    rule.saves += 4;
  }
  if (names.has("prone")) {
    rule.armorClass -= 4;
    rule.cannotAttack = true;
  }
  if (names.has("staggered")) rule.armorClass -= 2;
  if (names.has("stunned")) {
    rule.armorClass -= 4;
    rule.disablesShieldAndDexterity = true;
    rule.cannotAct = true;
    rule.cannotAttack = true;
  }
  if (names.has("normal sleep")) {
    rule.armorClass -= 4;
    rule.disablesShieldAndDexterity = true;
    rule.cannotAct = true;
    rule.cannotAttack = true;
  }
  if (names.has("held / paralyzed") || names.has("magical sleep") || names.has("unconscious")) {
    rule.helpless = true;
    rule.cannotAct = true;
    rule.cannotAttack = true;
  }
  if (names.has("dead")) {
    rule.cannotAct = true;
    rule.cannotAttack = true;
  }
  if (names.has("lost next action")) {
    rule.cannotAct = true;
    rule.cannotAttack = true;
  }
  return rule;
}

export function conditionSummary(rule: ConditionRule) {
  const parts: string[] = [];
  if (rule.attack) parts.push(`${rule.attack > 0 ? "+" : ""}${rule.attack} THB`);
  if (rule.armorClass) parts.push(`${rule.armorClass > 0 ? "+" : ""}${rule.armorClass} AC`);
  if (rule.saves) parts.push(`${rule.saves > 0 ? "+" : ""}${rule.saves} saves`);
  if (rule.damage) parts.push(`${rule.damage > 0 ? "+" : ""}${rule.damage} damage`);
  if (rule.helpless) parts.push("automatic hits");
  else if (rule.cannotAct) parts.push("cannot act");
  else if (rule.cannotAttack) parts.push("cannot attack");
  return parts.join(" · ");
}
