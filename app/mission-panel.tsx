"use client";

import type { CampaignState } from "./types";
import { characterTileStyle } from "./tile-color";
import CharacterNameLink from "./character-navigation";

type Props = {
  campaign: CampaignState;
  setCampaign: React.Dispatch<React.SetStateAction<CampaignState>>;
};

export default function MissionPanel({ campaign, setCampaign }: Props) {
  function toggleCharacter(characterId: string) {
    setCampaign((current) => {
      const selected = current.missionCharacterIds.includes(characterId);
      const missionCharacterIds = selected
        ? current.missionCharacterIds.filter((id) => id !== characterId)
        : [...current.missionCharacterIds, characterId];
      const marchingOrderIds = selected
        ? current.dashboard.marchingOrderIds.filter((id) => id !== characterId)
        : current.dashboard.marchingOrderIds.includes(characterId)
          ? current.dashboard.marchingOrderIds
          : [...current.dashboard.marchingOrderIds, characterId];
      const slots = current.dashboard.marchingOrderSlots.map((entry) => selected && entry === characterId ? null : entry);
      if (!selected && !slots.includes(characterId)) {
        const emptyIndex = slots.indexOf(null);
        if (emptyIndex >= 0) slots[emptyIndex] = characterId;
        else slots.push(characterId, ...Array.from({ length: Math.max(0, current.dashboard.marchColumns - 1) }, () => null));
      }
      return {
        ...current,
        missionCharacterIds,
        initiativeResults: current.initiativeResults.filter(
          (result) => result.characterId !== characterId,
        ),
        dashboard: {
          ...current.dashboard,
          marchingOrderIds,
          marchingOrderSlots: slots,
          lightCarrierIds: selected
            ? current.dashboard.lightCarrierIds.filter((id) => id !== characterId)
            : current.dashboard.lightCarrierIds,
          scoutingCharacterId: selected && current.dashboard.scoutingCharacterId === characterId ? null : current.dashboard.scoutingCharacterId,
        },
      };
    });
  }

  const selected = campaign.characters.filter((character) =>
    campaign.missionCharacterIds.includes(character.id),
  );
  const pooled = campaign.characters.filter((character) =>
    !campaign.missionCharacterIds.includes(character.id),
  );
  return (
    <section className="section-stack">
      <div className="section-heading">
        <div><h2>Character Stable</h2><p>Keep inactive characters in the stable and deploy only the characters joining the current mission.</p></div>
      </div>

      {campaign.characters.length === 0 ? (
        <div className="empty-state"><h3>No roster</h3><p>Add characters before building a mission party.</p></div>
      ) : (
        <div className="mission-lists">
          <div><h3>On the mission</h3><div className="mission-roster">
            {selected.length === 0 ? <div className="compact-empty">No characters deployed.</div> : selected.map((character) => (
              <article className="mission-choice selected" style={characterTileStyle(character.tileColor)} key={character.id}>
                <span className="mission-character-identity"><b className="small-tile-emoji">{character.emoji}</b><span><CharacterNameLink characterId={character.id}>{character.name}</CharacterNameLink><small>{character.player || "No player"} · {character.race} {character.className} {character.level}</small></span></span>
                <span className="mission-numbers">DEX {character.stats[1]}</span>
                <button onClick={() => toggleCharacter(character.id)}>Return to pool</button>
              </article>
            ))}
          </div></div>
          <div><h3>Character pool</h3><div className="mission-roster">
            {pooled.length === 0 ? <div className="compact-empty">The pool is empty.</div> : pooled.map((character) => (
              <article className="mission-choice" style={characterTileStyle(character.tileColor)} key={character.id}>
                <span className="mission-character-identity"><b className="small-tile-emoji">{character.emoji}</b><span><CharacterNameLink characterId={character.id}>{character.name}</CharacterNameLink><small>{character.player || "No player"} · {character.race} {character.className} {character.level}</small></span></span>
                <span className="mission-numbers">DEX {character.stats[1]}</span>
                <button onClick={() => toggleCharacter(character.id)}>Add to mission</button>
              </article>
            ))}
          </div></div>
        </div>
      )}

    </section>
  );
}
