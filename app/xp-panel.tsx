"use client";

import { useState } from "react";
import type { CampaignState, RecentEnemyType, XpEnemy, XpTrackerState } from "./types";
import { monsterXpBreakdown } from "./osric-combat";
import CharacterNameLink from "./character-navigation";
import HpMathInput from "./hp-math-input";
import FormattedNumberInput from "./formatted-number-input";
import { sharedId } from "./shared-id";

type Props = { campaign: CampaignState; setCampaign: React.Dispatch<React.SetStateAction<CampaignState>> };

function id() { return sharedId(); }
function number(value: string, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function displayXp(value: number) { return Math.trunc(value).toLocaleString("en-US"); }

function calculatedEnemy(enemy: Omit<XpEnemy, "xp"> | XpEnemy) {
  return monsterXpBreakdown(enemy.hitDice, enemy.hitPoints, enemy.specialAbilities, enemy.exceptionalAbilities).total;
}

export default function XpPanel({ campaign, setCampaign }: Props) {
  const [notice, setNotice] = useState("");
  const tracker = campaign.xpTracker;
  const currentTreasureXp = Math.trunc(tracker.treasureGp);
  const missionCharacters = campaign.characters.filter((character) => campaign.missionCharacterIds.includes(character.id));
  const enemyXp = tracker.enemies.reduce((sum, enemy) => sum + Math.trunc(enemy.xp), 0);
  const roomXp = tracker.roomsExplored * (tracker.roomsExplored + 1) * 5;
  const totalPool = Math.max(0, Math.trunc(enemyXp + currentTreasureXp + roomXp + tracker.otherXp));
  const totalShares = missionCharacters.reduce((sum, character) => sum + Math.max(0, tracker.shareWeights[character.id] ?? 1), 0);

  function updateTracker(patch: Partial<XpTrackerState>) {
    setCampaign((current) => ({ ...current, xpTracker: { ...current.xpTracker, ...patch } }));
  }

  function addEnemy(recent?: RecentEnemyType) {
    const draft = {
      id: id(), name: recent?.name ?? "Enemy", hitDice: recent?.hitDice ?? "1", hitPoints: recent?.typicalHp ?? 4,
      specialAbilities: recent?.specialAbilities ?? 0, exceptionalAbilities: recent?.exceptionalAbilities ?? 0,
    };
    updateTracker({ enemies: [...tracker.enemies, { ...draft, xp: calculatedEnemy(draft) }] });
  }

  function updateEnemy(enemyId: string, patch: Partial<XpEnemy>, recalculate = false) {
    updateTracker({ enemies: tracker.enemies.map((enemy) => {
      if (enemy.id !== enemyId) return enemy;
      const updated = { ...enemy, ...patch };
      return recalculate ? { ...updated, xp: calculatedEnemy(updated) } : updated;
    }) });
  }

  function setShareWeight(characterId: string, weight: number) {
    updateTracker({ shareWeights: { ...tracker.shareWeights, [characterId]: Math.max(0, weight) } });
  }

  function shareFor(characterId: string) {
    if (totalShares <= 0) return 0;
    return Math.floor(totalPool * Math.max(0, tracker.shareWeights[characterId] ?? 1) / totalShares);
  }

  function primeBonusFor(characterId: string) {
    return tracker.primeXpBonuses[characterId] ? Math.floor(shareFor(characterId) * .1) : 0;
  }

  function assignedXpFor(characterId: string) {
    return shareFor(characterId) + primeBonusFor(characterId);
  }

  function awardPool() {
    if (!missionCharacters.length) return setNotice("Add characters to the mission before awarding XP.");
    if (totalPool <= 0 || totalShares <= 0) return setNotice("There is no XP pool or no positive shares to award.");
    const awards = new Map(missionCharacters.map((character) => [character.id, assignedXpFor(character.id)]));
    setCampaign((current) => ({
      ...current,
      characters: current.characters.map((character) => {
        const award = awards.get(character.id);
        return award === undefined ? character : { ...character, currentXp: Math.trunc(character.currentXp) + award };
      }),
      xpTracker: { ...current.xpTracker, enemies: [], treasureGp: 0, roomsExplored: 0, otherXp: 0 },
    }));
    const primeTotal = missionCharacters.reduce((sum, character) => sum + primeBonusFor(character.id), 0);
    setNotice(`${displayXp(totalPool)} pool XP${primeTotal ? ` plus ${displayXp(primeTotal)} prime-requisite bonus XP` : ""} awarded in whole-number shares. Any remainder was discarded. The pool has been cleared.`);
  }

  function clearPool() {
    if (!window.confirm("Clear the unawarded XP pool?")) return;
    updateTracker({ enemies: [], treasureGp: 0, roomsExplored: 0, otherXp: 0 });
    setNotice("The unawarded XP pool was cleared.");
  }

  function clearRecentEnemies() {
    if (!tracker.recentEnemies.length) return;
    updateTracker({ recentEnemies: [] });
    setNotice("Recent defeated foes cleared.");
  }

  return <section className="section-stack xp-panel">
    <div className="workspace-action-row xp-heading-actions"><button className="action-link" onClick={clearPool}>Clear pool</button><button className="primary-button" disabled={!missionCharacters.length || totalPool <= 0 || totalShares <= 0} onClick={awardPool}>Award XP</button></div>
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="xp-summary-grid"><div><span>Enemies</span><strong>{displayXp(enemyXp)} XP</strong></div><div><span>Treasure</span><strong>{displayXp(currentTreasureXp)} XP</strong></div><div><span>Rooms</span><strong>{displayXp(roomXp)} XP</strong></div><div><span>Other</span><strong>{displayXp(tracker.otherXp)} XP</strong></div><div className="xp-pool-total"><span>Total pool</span><strong>{displayXp(totalPool)} XP</strong></div></div>

    <section className="panel recent-enemy-panel"><div className="panel-heading split-heading"><div><h2>Recent enemy types</h2><p>The last 20 defeated foes retained when combat ends. Quick-add uses their HD, typical HP, and ability bonuses.</p></div><button className="action-link danger-link" disabled={!tracker.recentEnemies.length} onClick={clearRecentEnemies}>Clear history</button></div>{tracker.recentEnemies.length === 0 ? <div className="compact-empty">End a combat with named enemies to build this list.</div> : <div className="recent-enemy-list">{tracker.recentEnemies.map((enemy) => <button onClick={() => addEnemy(enemy)} key={enemy.id}><strong>{enemy.name}</strong><small>HD {enemy.hitDice} · {enemy.typicalHp} HP{enemy.specialAbilities ? ` · ${enemy.specialAbilities} special` : ""}{enemy.exceptionalAbilities ? ` · ${enemy.exceptionalAbilities} exceptional` : ""}</small></button>)}</div>}</section>

    <div className="two-column xp-source-grid">
      <section className="panel xp-enemy-panel"><div className="panel-heading split-heading"><div><h2>Enemies defeated</h2><p>XP follows the OSRIC GM table: base + per-HP value + each special or exceptional ability. The final XP remains editable.</p></div><button className="primary-button" onClick={() => addEnemy()}>Add enemy</button></div>
        {tracker.enemies.length === 0 ? <div className="compact-empty">No defeated enemies recorded.</div> : <div className="xp-enemy-list">{tracker.enemies.map((enemy) => { const breakdown = monsterXpBreakdown(enemy.hitDice, enemy.hitPoints, enemy.specialAbilities, enemy.exceptionalAbilities); return <article key={enemy.id}>
          <div className="xp-enemy-fields"><label>Enemy<input value={enemy.name} onChange={(event) => updateEnemy(enemy.id, { name: event.target.value })} /></label><label>HD<input value={enemy.hitDice} onChange={(event) => updateEnemy(enemy.id, { hitDice: event.target.value }, true)} placeholder="2+1" /></label><label>HP<HpMathInput ariaLabel={`${enemy.name || "Enemy"} hit points`} value={enemy.hitPoints} minimum={0} onCommit={(hitPoints) => updateEnemy(enemy.id, { hitPoints }, true)} /></label><label>XP<FormattedNumberInput ariaLabel={`${enemy.name || "Enemy"} XP`} value={enemy.xp} min={0} onCommit={(xp) => updateEnemy(enemy.id, { xp: Math.trunc(xp) })} /></label></div>
          <div className="xp-ability-bonuses"><span><b>{enemy.specialAbilities}</b> special</span><button onClick={() => updateEnemy(enemy.id, { specialAbilities: Math.max(0, enemy.specialAbilities - 1) }, true)}>−</button><button onClick={() => updateEnemy(enemy.id, { specialAbilities: enemy.specialAbilities + 1 }, true)}>+</button><span><b>{enemy.exceptionalAbilities}</b> exceptional</span><button onClick={() => updateEnemy(enemy.id, { exceptionalAbilities: Math.max(0, enemy.exceptionalAbilities - 1) }, true)}>−</button><button onClick={() => updateEnemy(enemy.id, { exceptionalAbilities: enemy.exceptionalAbilities + 1 }, true)}>+</button></div>
          <small className="xp-breakdown">{displayXp(breakdown.base)} base + {displayXp(breakdown.hp)} HP + {displayXp(breakdown.special)} special + {displayXp(breakdown.exceptional)} exceptional = {displayXp(breakdown.total)} table XP</small><button className="action-link danger-link" onClick={() => updateTracker({ enemies: tracker.enemies.filter((entry) => entry.id !== enemy.id) })}>Remove</button>
        </article>; })}</div>}
      </section>

      <section className="panel xp-other-sources"><div className="panel-heading"><div><h2>Exploration &amp; Treasure</h2><p>Enter recovered treasure XP manually. Inventory sales never add XP automatically.</p></div></div><label>Treasure recovered (gp)<FormattedNumberInput ariaLabel="Treasure recovered in GP" value={currentTreasureXp} min={0} onCommit={(treasureGp) => updateTracker({ treasureGp: Math.trunc(treasureGp) })} /><small>One recovered GP is one XP.</small></label><label>Other XP<FormattedNumberInput ariaLabel="Other XP" value={tracker.otherXp} min={0} onCommit={(otherXp) => updateTracker({ otherXp: Math.trunc(otherXp) })} /></label><div className="room-xp-control"><div><span>Rooms explored</span><strong>{tracker.roomsExplored.toLocaleString("en-US")}</strong><small>{displayXp(roomXp)} XP · next room {((tracker.roomsExplored + 1) * 10).toLocaleString("en-US")} XP</small></div><div><button disabled={!tracker.roomsExplored} onClick={() => updateTracker({ roomsExplored: Math.max(0, tracker.roomsExplored - 1) })}>− Room</button><button className="primary-button" onClick={() => updateTracker({ roomsExplored: tracker.roomsExplored + 1 })}>+ Room</button></div></div></section>
    </div>

    <section className="panel xp-split-panel"><div className="panel-heading"><div><h2>Mission split</h2><p>Use 0.5 for a half share, 2 for a double share, or 0 for no share. Prime bonus is added after the split.</p></div></div>{missionCharacters.length === 0 ? <div className="compact-empty">Add characters to the current mission first.</div> : <div className="xp-share-list">{missionCharacters.map((character) => <div className="xp-share-row" key={character.id}><span className="xp-share-character"><b>{character.emoji}</b><span><CharacterNameLink characterId={character.id}>{character.name}</CharacterNameLink><small>{character.className} {character.level}</small></span></span><label>Shares<input type="number" min="0" step="0.5" value={tracker.shareWeights[character.id] ?? 1} onChange={(event) => setShareWeight(character.id, number(event.target.value))} /></label><label className="prime-xp-toggle"><input type="checkbox" checked={Boolean(tracker.primeXpBonuses[character.id])} onChange={(event) => updateTracker({ primeXpBonuses: { ...tracker.primeXpBonuses, [character.id]: event.target.checked } })} />10% to XP</label><span className="xp-award-preview"><small>Would receive{primeBonusFor(character.id) ? ` · ${displayXp(shareFor(character.id))} + ${displayXp(primeBonusFor(character.id))}` : ""}</small><strong>{displayXp(assignedXpFor(character.id))} XP</strong></span></div>)}</div>}</section>
  </section>;
}
