export type ManualCombatModifier = {
  normalized: string;
  add: number;
  double: boolean;
  doubleFirst: boolean;
};

export function parseManualCombatModifier(value: string | null | undefined): ManualCombatModifier {
  const compact = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!compact || compact === "+" || compact === "-") return { normalized: "+0", add: 0, double: false, doubleFirst: false };
  const match = compact.match(/^(?:(dd)([+-]?\d+)?|([+-]?\d+)(dd)?)$/);
  if (!match) return { normalized: "+0", add: 0, double: false, doubleFirst: false };
  const doubleFirst = Boolean(match[1]);
  const double = doubleFirst || Boolean(match[4]);
  const numeric = match[2] ?? match[3] ?? "0";
  const add = Number.parseInt(numeric, 10) || 0;
  const signed = add >= 0 ? `+${add}` : String(add);
  return {
    normalized: double ? (doubleFirst ? `dd${add ? signed : ""}` : `${signed === "+0" ? "" : signed}dd`) : signed,
    add,
    double,
    doubleFirst,
  };
}

export function applyManualCombatModifier(base: number, value: string | null | undefined) {
  const parsed = parseManualCombatModifier(value);
  if (!parsed.double) return base + parsed.add;
  return parsed.doubleFirst ? base * 2 + parsed.add : (base + parsed.add) * 2;
}
