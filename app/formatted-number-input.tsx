"use client";

import { useState } from "react";

type Props = {
  ariaLabel: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  maximumFractionDigits?: number;
  className?: string;
  readOnly?: boolean;
  relative?: boolean;
};

function formatted(value: number, maximumFractionDigits: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits });
}

function evaluateEntry(entry: string) {
  const normalized = entry.replaceAll(",", "").replaceAll("−", "-").replaceAll(/\s+/g, "");
  if (!normalized || !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[+-](?:\d+(?:\.\d+)?|\.\d+))*$/.test(normalized)) return null;
  const terms = normalized.match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? [];
  const total = terms.reduce((sum, term) => sum + Number(term), 0);
  return Number.isFinite(total) ? total : null;
}

export default function FormattedNumberInput({
  ariaLabel,
  value,
  onCommit,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  maximumFractionDigits = 0,
  className,
  readOnly = false,
  relative = false,
}: Props) {
  const [draft, setDraft] = useState(() => formatted(value, maximumFractionDigits));
  const [editing, setEditing] = useState(false);

  function commit() {
    const normalized = draft.replaceAll(",", "").replaceAll("−", "-").replaceAll(/\s+/g, "");
    const parsed = evaluateEntry(normalized);
    const requested = parsed !== null
      ? relative && /^[+-]/.test(normalized) ? value + parsed : parsed
      : value;
    const bounded = Math.min(max, Math.max(min, requested));
    const next = maximumFractionDigits === 0 ? Math.trunc(bounded) : bounded;
    onCommit(next);
    setEditing(false);
  }

  return <input
    aria-label={ariaLabel}
    className={className}
    type="text"
    inputMode={maximumFractionDigits > 0 ? "decimal" : "numeric"}
    value={editing ? draft : formatted(value, maximumFractionDigits)}
    onFocus={(event) => {
      if (readOnly) return;
      setEditing(true);
      setDraft(String(value));
      event.currentTarget.select();
    }}
    onChange={(event) => { if (!readOnly) setDraft(event.target.value); }}
    onBlur={() => { if (!readOnly) commit(); }}
    onKeyDown={(event) => {
      if (event.key === "Enter") event.currentTarget.blur();
    }}
    min={Number.isFinite(min) ? min : undefined}
    max={Number.isFinite(max) ? max : undefined}
    step={step}
    readOnly={readOnly}
    title={relative ? "Enter a number to set the amount, or start with + or − to adjust it." : undefined}
  />;
}
