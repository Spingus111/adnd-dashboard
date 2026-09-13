"use client";

import { useEffect, useRef, useState } from "react";
import { evaluateHpEntry } from "./hp-math";

type Props = {
  value: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  minimum?: number;
  className?: string;
};

function displayValue(value: number) {
  return value === 0 ? "" : String(value);
}

export default function HpMathInput({ value, onCommit, ariaLabel, minimum = Number.NEGATIVE_INFINITY, className }: Props) {
  const [draft, setDraft] = useState(displayValue(value));
  const startingValue = useRef(value);
  const editing = useRef(false);
  const cancelling = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(displayValue(value));
  }, [value]);

  function commit() {
    if (cancelling.current) {
      cancelling.current = false;
      editing.current = false;
      setDraft(displayValue(value));
      return;
    }
    const next = Math.max(minimum, Math.trunc(evaluateHpEntry(draft, startingValue.current)));
    editing.current = false;
    setDraft(displayValue(next));
    onCommit(next);
  }

  return <input
    className={className}
    aria-label={ariaLabel}
    inputMode="numeric"
    value={draft}
    placeholder="0"
    title="Enter a number to set HP, +number to heal, or -number to deal damage. Blank equals 0."
    onFocus={(event) => {
      editing.current = true;
      startingValue.current = value;
      event.currentTarget.select();
    }}
    onChange={(event) => setDraft(event.target.value)}
    onBlur={commit}
    onKeyDown={(event) => {
      if (event.key === "Enter") event.currentTarget.blur();
      if (event.key === "Escape") {
        cancelling.current = true;
        event.currentTarget.blur();
      }
    }}
  />;
}
