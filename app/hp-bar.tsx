"use client";

type Props = {
  current: number;
  maximum: number;
  label?: string;
  compact?: boolean;
  temporary?: number;
  showTemporaryValue?: boolean;
};

export default function HpBar({ current, maximum, label = "HP", compact = false, temporary = 0, showTemporaryValue = true }: Props) {
  const displayMaximum = Math.max(0, maximum || 0);
  const safeMaximum = Math.max(1, displayMaximum);
  const temp = Math.max(0, Math.floor(temporary || 0));
  const effective = current - temp;
  const realPercent = Math.max(0, Math.min(100, current / safeMaximum * 100));
  const effectivePercent = Math.max(0, Math.min(realPercent, effective / safeMaximum * 100));
  const tempPercent = Math.max(0, realPercent - effectivePercent);
  const state = effective < 0 ? "negative" : current > displayMaximum ? "overfull" : effectivePercent > 49 ? "healthy" : "wounded";
  return (
    <span className={`hp-bar ${state} ${temp ? "has-temporary" : ""} ${compact ? "compact" : ""}`} aria-label={`${label} ${current} of ${displayMaximum}${temp ? showTemporaryValue ? `, ${temp} temporary damage, ${effective} effective hit points` : ", temporary damage shown in yellow" : ""}`}>
      <span className="hp-bar-fill" style={{ width: `${state === "negative" && !temp ? 100 : effectivePercent}%` }} />
      {temp > 0 && <span className="hp-bar-temporary" style={{ left: `${effectivePercent}%`, width: `${tempPercent}%` }} />}
      <b>{label} {Math.max(-10, current)}/{displayMaximum}{temp && showTemporaryValue ? ` · ${temp} TEMP` : ""}</b>
    </span>
  );
}

export function monsterHealthSegments(current: number, maximum: number) {
  const safeMaximum = Math.max(1, maximum || 0);
  const ratio = Math.max(0, Math.min(1, current / safeMaximum));
  return current > 0 ? Math.max(1, Math.floor(ratio * 4)) : 0;
}

export function MonsterHpBar({ current, maximum, showValues, temporary = 0 }: { current: number; maximum: number; showValues: boolean; temporary?: number }) {
  const realSegments = monsterHealthSegments(current, maximum);
  const filledSegments = monsterHealthSegments(current - Math.max(0, temporary), maximum);
  const overfull = current > Math.max(0, maximum);
  const labels = ["red", "orange", "yellow", "green"] as const;
  return <span className="monster-hp-readout">
    <span className={`monster-hp-bar ${overfull ? "overfull" : ""}`} aria-label={showValues ? `HP ${current} of ${Math.max(0, maximum)}` : `Monster health ${filledSegments} of 4`}>
      {labels.map((color, index) => <i className={`${color} ${index < filledSegments ? "filled" : index < realSegments ? "temporary" : ""}`} aria-hidden="true" key={color} />)}
    </span>
    {showValues && <b>HP {Math.max(-10, current)}/{Math.max(0, maximum)}{temporary ? ` · ${temporary} TEMP` : ""}</b>}
  </span>;
}
