"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { armorCategoryToAscendingAc, weaponHandednessHint, weaponRulesById, weaponRulesForName, type ArmorCategory, type WeaponRules } from "./weapon-rules";

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function usePopoverPosition(open: boolean, anchor: React.RefObject<HTMLElement | null>) {
  const [style, setStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(360, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const below = rect.bottom + 8;
      const top = below + 300 < window.innerHeight ? below : Math.max(8, rect.top - 308);
      setStyle({ left, top, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor]);
  return style;
}

function WeaponCard({ rules }: { rules: WeaponRules }) {
  return <div className="weapon-rules-card">
    <strong>{rules.name}</strong>
    <dl>
      <div><dt>Damage S/M</dt><dd>{rules.damageSM}</dd></div>
      <div><dt>Damage L</dt><dd>{rules.damageL}</dd></div>
      <div><dt>Speed</dt><dd>{rules.speedFactorDisplay ?? rules.speedFactor ?? "—"}</dd></div>
      <div><dt>Length</dt><dd>{rules.length}</dd></div>
      <div><dt>Space</dt><dd>{rules.spaceRequired}</dd></div>
      <div><dt>Type</dt><dd>{rules.damageType}</dd></div>
      <div><dt>Hands</dt><dd>{weaponHandednessHint(rules) || `${rules.normalHands}H`}</dd></div>
      {rules.missileMode && <div><dt>Missile use</dt><dd>{rules.missileMode === "thrown" ? "Thrown" : "Projectile"}</dd></div>}
      {rules.missileRateOfFire != null && <div><dt>Rate of fire</dt><dd>{rules.missileRateOfFire}</dd></div>}
      {rules.missileRanges && <div><dt>Range S/M/L</dt><dd>{rules.missileRanges.short} / {rules.missileRanges.medium} / {rules.missileRanges.long}</dd></div>}
    </dl>
    <div className="weapon-armour-row"><span>vs physical armour</span><div className="weapon-armour-grid">{Object.entries(rules.armorAdjustments).map(([category, adjustment]) => <span key={category}><b>AC {armorCategoryToAscendingAc(Number(category) as ArmorCategory)}:</b> {signed(adjustment)}</span>)}</div></div>
    {rules.canSetVsCharge && <small>May be set against a charge.</small>}
    {rules.notes && <small>{rules.notes}</small>}
  </div>;
}

export function RulesPopoverButton({ className, label, children, panel }: { className: string; label: string; children: ReactNode; panel: ReactNode }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const style = usePopoverPosition(open, anchor);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !popover.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return <>
    <button ref={anchor} type="button" className={className} aria-label={label} aria-expanded={open} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={(event) => { if (!popover.current?.contains(event.relatedTarget as Node)) setOpen(false); }} onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}>{children}</button>
    {open && typeof document !== "undefined" && createPortal(<div ref={popover} className="weapon-rules-popover" role="dialog" aria-label={label} style={style} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>{panel}</div>, document.body)}
  </>;
}

export function WeaponRulesTooltip({ rulesId, name, children }: { rulesId?: string | null; name?: string | null; children?: ReactNode }) {
  const rules = weaponRulesById(rulesId) ?? weaponRulesForName(name);
  if (!rules) return <>{children ?? name}</>;
  return <RulesPopoverButton className="weapon-name-trigger" label={`${rules.name} weapon rules`} panel={<WeaponCard rules={rules} />}>{children ?? name ?? rules.name}</RulesPopoverButton>;
}

export function EquipmentRulesInfoButton() {
  return <RulesPopoverButton className="equipment-info-trigger" label="Equipment rules key" panel={<div className="equipment-rules-key"><strong>Weapon information</strong><dl><div><dt>Damage S/M</dt><dd>Damage against small or man-sized targets.</dd></div><div><dt>Damage L</dt><dd>Damage against large targets.</dd></div><div><dt>Speed Factor</dt><dd>Breaks segment ties and may add attacks in established melee.</dd></div><div><dt>Length</dt><dd>Weapon reach for charge or closing first strike.</dd></div><div><dt>Space Required</dt><dd>Room needed to wield the weapon.</dd></div><div><dt>Damage Type</dt><dd>Bludgeoning, piercing, slashing, or a combination.</dd></div><div><dt>Armour Adjustment</dt><dd>Contextual to-hit modifier against physical armour.</dd></div></dl></div>}>ⓘ</RulesPopoverButton>;
}

export function NaturalSpeedInfoButton() {
  return <RulesPopoverButton className="equipment-info-trigger" label="Natural attack speed" panel={<div className="equipment-rules-key"><strong>Natural speed</strong><dl><div><dt>Fast — SF 2</dt><dd>Quick claw, bite, or agile strike.</dd></div><div><dt>Normal — SF 6</dt><dd>Ordinary bite, horn, or slam.</dd></div><div><dt>Slow — SF 11</dt><dd>Giant fist, tail smash, or ponderous limb.</dd></div></dl><small>Used for weapon-speed comparisons once melee is established.</small></div>}>ⓘ</RulesPopoverButton>;
}
