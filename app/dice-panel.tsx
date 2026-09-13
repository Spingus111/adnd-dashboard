"use client";

import { useState } from "react";
import type { CampaignState, DiceResult } from "./types";
import { sharedId } from "./shared-id";
import { rollSecureDie, secureRandomInteger } from "./random";

type Props = {
  campaign: CampaignState;
  setCampaign: React.Dispatch<React.SetStateAction<CampaignState>>;
};

const dice = [100, 20, 12, 10, 8, 6, 4] as const;

function id() {
  return sharedId();
}

export default function DicePanel({ campaign, setCampaign }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries([...dice.map((sides) => [`d${sides}`, 1]), ["coin", 1]]),
  );

  function changeCount(key: string, amount: number) {
    setCounts((current) => ({ ...current, [key]: Math.min(5, Math.max(1, current[key] + amount)) }));
  }

  function record(result: DiceResult) {
    setCampaign((current) => ({ ...current, diceLog: [result, ...current.diceLog].slice(0, 20) }));
  }

  function rollDie(sides: number) {
    const count = counts[`d${sides}`];
    const rolls = Array.from({ length: count }, () => rollSecureDie(sides));
    record({ id: id(), label: `${count}d${sides}`, rolls, total: rolls.reduce((sum, roll) => sum + roll, 0) });
  }

  function flipCoins() {
    const count = counts.coin;
    const flips = Array.from({ length: count }, () => secureRandomInteger(2) === 0 ? "Heads" : "Tails");
    record({ id: id(), label: `${count} coin${count === 1 ? "" : "s"}`, rolls: flips, total: null });
  }

  return (
    <section className="section-stack">
      <div className="section-heading"><div><h2>Dice Roller</h2><p>Roll one to five dice of a common size and total the result.</p></div><button onClick={() => setCampaign((current) => ({ ...current, diceLog: [] }))}>Clear history</button></div>
      <div className="dice-grid">
        {dice.map((sides) => {
          const key = `d${sides}`;
          return (
            <div className="die-card" key={key}>
              <strong>d{sides}</strong>
              <div className="stepper"><button aria-label={`Decrease ${key} count`} onClick={() => changeCount(key, -1)}>−</button><span>{counts[key]}</span><button aria-label={`Increase ${key} count`} onClick={() => changeCount(key, 1)}>+</button></div>
              <button className="primary-button" onClick={() => rollDie(sides)}>Roll {counts[key]}d{sides}</button>
            </div>
          );
        })}
        <div className="die-card">
          <strong>Coin</strong>
          <div className="stepper"><button aria-label="Decrease coin count" onClick={() => changeCount("coin", -1)}>−</button><span>{counts.coin}</span><button aria-label="Increase coin count" onClick={() => changeCount("coin", 1)}>+</button></div>
          <button className="primary-button" onClick={flipCoins}>Flip {counts.coin}</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-heading"><div><h2>Recent Rolls</h2><p>The last 20 rolls are kept with the campaign.</p></div></div>
        {campaign.diceLog.length === 0 ? <div className="compact-empty">No dice rolled yet.</div> : (
          <div className="roll-log">
            {campaign.diceLog.map((result) => (
              <div className="roll-result" key={result.id}>
                <strong>{result.label}</strong>
                <span>{result.rolls.join(" + ")}</span>
                <b>{result.total === null ? result.rolls.join(" / ") : `Total ${result.total}`}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
