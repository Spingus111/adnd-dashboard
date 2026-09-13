import type { Character, CharacterWeapon, PreparedSpellSlot, SpellbookEntry, WeaponTrainingChoice } from "./types.ts";
import { phbWeaponRules, weaponRulesById, weaponRulesForName, type WeaponRules } from "./weapon-rules.ts";

export type SpellTradition = "arcane" | "phantasmal" | "divine" | "druidic";
export type SpellcastingTrack = {
  id: string;
  className: string;
  classLevel: number;
  tradition: SpellTradition;
  casterLevel: number;
  usesSpellbook: boolean;
  baseSlots: number[];
  wisdomSlots: number[];
  slots: number[];
};

const rows = (source: number[][]) => source;

export const MAGIC_USER_SLOTS = rows([
  [1],[2],[2,1],[3,2],[4,2,1],[4,3,2],[4,3,2,1],[4,3,3,2],[4,4,3,2,1],[4,4,3,2,2],
  [4,4,4,3,3],[5,4,4,3,3,1],[5,5,4,3,3,2],[5,5,5,4,4,2,1],[5,5,5,4,4,3,2],
  [5,5,5,4,4,3,2,1],[5,5,5,5,5,4,3,2],[5,5,5,5,5,4,3,2,1],[5,5,5,5,5,5,4,3,1],[5,5,5,5,5,5,4,3,2],
]);
export const CLERIC_SLOTS = rows([
  [1],[2],[2,1],[3,2],[3,3,1],[3,3,2],[3,3,2,1],[3,3,3,2],[4,4,3,2,1],[4,4,3,3,2],
  [5,4,4,3,2,1],[6,5,5,3,2,2],[6,6,6,4,2,2],[6,6,6,5,3,2],[7,7,7,5,4,2],
  [7,7,7,6,5,3,1],[8,8,8,6,5,3,1],[8,8,8,7,6,4,1],[9,9,9,7,6,4,2],[9,9,9,8,7,5,2],
]);
export const DRUID_SLOTS = rows([
  [2],[2,1],[3,2,1],[4,2,2],[4,3,2],[4,3,2,1],[4,4,3,1],[4,4,3,2],[5,4,3,2,1],[5,4,3,3,2],
  [5,5,3,3,2,1],[5,5,4,4,3,2,1],[6,5,5,5,4,3,2],[6,6,6,6,5,4,3],
]);
export const ILLUSIONIST_SLOTS = rows([
  [1],[2],[2,1],[3,2],[4,3,1],[4,3,2],[4,3,2,1],[4,3,2,2],[5,3,3,2],[5,4,3,2,1],
  [5,4,3,3,2],[5,5,4,3,2,1],[5,5,4,3,2,2],[5,5,4,3,2,2,1],[5,5,4,4,2,2,2],
  [5,5,5,4,3,2,2],[6,5,5,4,3,3,2],[6,6,5,4,4,3,2],[6,6,5,5,5,3,2],[6,6,6,5,5,4,2],
]);
export const PALADIN_SLOTS = rows([
  [],[],[],[],[],[],[],[],[1],[2],[2,1],[2,2],[2,2,1],[3,2,1],[3,2,1,1],[3,3,1,1],
  [3,3,2,1],[3,3,3,1],[3,3,3,2],[3,3,3,3],
]);
export const RANGER_DRUIDIC_SLOTS = rows([
  [],[],[],[],[],[],[],[1],[1],[2],[2],[2,1],[2,1],[2,2],[2,2],[2,2,1],[2,2,2],[3,2,2],[3,2,2],[3,3,2],
]);
export const RANGER_ARCANE_SLOTS = rows([
  [],[],[],[],[],[],[],[],[1],[1],[2],[2],[2,1],[2,1],[2,2],[2,2],[2,2],[2,2],[3,2],[3,2],
]);

export const OSRIC_SPELLS: Record<SpellTradition, Record<number, string[]>> = {
  arcane: {
    1:["Affect Normal Fires","Burning Hands","Charm Person","Comprehend Languages","Dancing Lights","Detect Magic","Enlarge","Erase","Feather Fall","Find Familiar","Friends","Hold Portal","Identify","Jump","Light","Magic Missile","Mending","Message","Protection from Evil","Push","Read Magic","Shield","Shocking Grasp","Sleep","Spider Climb","Tenser’s Floating Disc","Unseen Servant","Ventriloquism","Write"],
    2:["Continual Light","Darkness 15 ft Radius","Detect Evil","Detect Invisibility","ESP","Invisibility","Knock","Levitate","Locate Object","Magic Mouth","Mirror Image","Pyrotechnics","Ray of Enfeeblement","Rope Trick","Scare","Shatter","Stinking Cloud","Strength","Web","Wizard Lock"],
    3:["Blink","Clairaudience","Clairvoyance","Dispel Magic","Explosive Runes","Fireball","Fly","Haste","Hold Person","Infravision","Invisibility 10 ft Radius","Lightning Bolt","Monster Summoning I","Phantasmal Force","Protection from Evil 10 ft Radius","Protection from Normal Missiles","Slow","Suggestion","Tongues","Water Breathing"],
    4:["Charm Monster","Confusion","Dimension Door","Fear","Fire Shield","Fire Trap","Fumble","Hallucinatory Terrain","Ice Storm","Massmorph","Minor Globe of Invulnerability","Monster Summoning II","Polymorph Other","Polymorph Self","Remove Curse","Wall of Fire","Wall of Ice","Wizard Eye"],
    5:["Animate Dead","Cloudkill","Conjure Elemental","Contact Other Plane","Feeblemind","Hold Monster","Magic Jar","Monster Summoning III","Passwall","Stone Shape","Telekinesis","Teleport","Transmute Rock to Mud","Wall of Force","Wall of Stone"],
    6:["Anti-Magic Shell","Control Weather","Death Spell","Disintegrate","Geas","Globe of Invulnerability","Guards and Wards","Invisible Stalker","Legend Lore","Monster Summoning IV","Move Earth","Project Image","Reincarnation"],
    7:["Delayed Blast Fireball","Limited Wish","Mass Invisibility","Monster Summoning V","Phase Door","Power Word Stun","Reverse Gravity","Simulacrum","Teleport Without Error"],
    8:["Clone","Incendiary Cloud","Mass Charm","Maze","Monster Summoning VI","Otto’s Irresistible Dance","Permanency","Power Word Blind","Symbol","Trap the Soul"],
    9:["Astral Spell","Gate","Imprisonment","Meteor Swarm","Monster Summoning VII","Power Word Kill","Shape Change","Time Stop","Wish"],
  },
  phantasmal: {
    1:["Audible Glamour","Change Self","Colour Spray","Dancing Lights","Darkness","Detect Illusion","Gaze Reflection","Hypnotism","Light","Phantasmal Force","Wall of Fog"],
    2:["Blindness","Blur","Deafness","Detect Magic","Fog Cloud","Hypnotic Pattern","Improved Phantasmal Force","Invisibility","Magic Mouth","Mirror Image","Misdirection","Ventriloquism"],
    3:["Continual Darkness","Continual Light","Dispel Illusion","Fear","Hallucinatory Terrain","Illusionary Script","Invisibility 10 ft Radius","Non-Detection","Paralyzation","Rope Trick","Spectral Force","Suggestion"],
    4:["Confusion","Dispel Magic","Emotion","Improved Invisibility","Massmorph","Minor Creation","Phantasmal Killer","Shadow Monsters","Solid Fog"],
    5:["Chaos","Demi-Shadow Monsters","Major Creation","Maze","Projected Image","Shadow Door","Shadow Magic","Summon Shadow"],
    6:["Conjure Animals","Demi-Shadow Magic","Mass Suggestion","Mislead","Permanent Illusion","Programmed Illusion","Shades","True Seeing","Veil"],
    7:["Alter Reality","Astral Spell","Prismatic Spray","Prismatic Wall","Vision"],
  },
  divine: {
    1:["Bless","Command","Create Water","Cure Light Wounds","Detect Evil","Detect Magic","Light","Protection from Evil","Purify Food and Drink","Remove Fear","Resist Cold","Sanctuary"],
    2:["Augury","Chant","Detect Charm","Find Traps","Hold Person","Know Alignment","Resist Fire","Silence 15 ft Radius","Slow Poison","Snake Charm","Speak with Animals","Spiritual Hammer"],
    3:["Animate Dead","Continual Light","Create Food and Water","Cure Blindness","Cure Disease","Dispel Magic","Feign Death","Glyph of Warding","Locate Object","Prayer","Remove Curse","Speak with Dead"],
    4:["Cure Serious Wounds","Detect Lie","Divination","Exorcise","Lower Water","Neutralize Poison","Protection from Evil 10 ft Radius","Speak with Plants","Sticks to Snakes","Tongues"],
    5:["Atonement","Commune","Cure Critical Wounds","Dispel Evil","Flame Strike","Insect Plague","Plane Shift","Quest","Raise Dead","True Seeing"],
    6:["Aerial Servant","Animate Object","Blade Barrier","Conjure Animals","Find the Path","Heal","Part Water","Speak with Monsters","Word of Recall"],
    7:["Astral Spell","Control Weather","Earthquake","Gate","Holy Word","Regenerate","Resurrection","Restoration","Symbol"],
  },
  druidic: {
    1:["Animal Friendship","Detect Magic","Detect Snares and Pits","Entangle","Faerie Fire","Invisibility to Animals","Locate Animals","Pass Without Trace","Predict Weather","Purify Water","Shillelagh","Speak with Animals"],
    2:["Barkskin","Charm Person or Mammal","Create Water","Cure Light Wounds","Feign Death","Fire Trap","Heat Metal","Locate Plants","Obscurement","Produce Flame","Trip","Warp Wood"],
    3:["Call Lightning","Cure Disease","Hold Animal","Neutralize Poison","Plant Growth","Protection from Fire","Pyrotechnics","Snare","Stone Shape","Summon Insects","Tree"],
    4:["Animal Summoning I","Call Woodland Beings","Control Temperature 10 ft Radius","Cure Serious Wounds","Dispel Magic","Hallucinatory Forest","Hold Plant","Plant Door","Produce Fire","Protection from Lightning"],
    5:["Animal Growth","Animal Summoning II","Anti-Plant Shell","Commune with Nature","Control Winds","Insect Plague","Pass Plant","Sticks to Snakes","Transmute Rock to Mud","Wall of Fire"],
    6:["Animal Summoning III","Anti-Animal Shell","Conjure Fire Elemental","Cure Critical Wounds","Feeblemind","Liveoak","Transport via Plants","Turn Wood","Weather Summoning"],
    7:["Animate Rock","Chariot of Sustarre","Confusion","Conjure Earth Elemental","Control Weather","Creeping Doom","Finger of Death","Fire Storm","Reincarnate","Transmute Metal to Wood"],
  },
};

function rowAt(table: number[][], level: number) {
  return [...(table[Math.max(1, Math.min(table.length, Math.floor(level))) - 1] ?? [])];
}

export function classComponents(character: Pick<Character, "className" | "level" | "classLevels">) {
  return character.className.split("/").map((name) => name.trim()).filter(Boolean).map((className) => ({
    className,
    level: Math.max(1, Math.floor(character.classLevels?.[className] ?? character.level ?? 1)),
  }));
}

export function classComponentLevel(character: Pick<Character, "className" | "level" | "classLevels">, className: string) {
  return classComponents(character).find((entry) => entry.className === className)?.level ?? 0;
}

function wisdomBonusSlots(wisdom: number, base: number[]) {
  const bonus = [
    (wisdom >= 13 ? 1 : 0) + (wisdom >= 14 ? 1 : 0),
    (wisdom >= 15 ? 1 : 0) + (wisdom >= 16 ? 1 : 0),
    wisdom >= 17 ? 1 : 0,
    wisdom >= 18 ? 1 : 0,
  ];
  return base.map((capacity, index) => capacity > 0 ? bonus[index] ?? 0 : 0);
}

function track(className: string, classLevel: number, tradition: SpellTradition, casterLevel: number, usesSpellbook: boolean, baseSlots: number[], wisdom = 0): SpellcastingTrack {
  const wisdomSlots = className === "Cleric" || className === "Druid" ? wisdomBonusSlots(wisdom, baseSlots) : baseSlots.map(() => 0);
  return { id: `${className.toLowerCase().replaceAll(" ", "-")}:${tradition}`, className, classLevel, tradition, casterLevel, usesSpellbook, baseSlots, wisdomSlots, slots: baseSlots.map((value, index) => value + wisdomSlots[index]) };
}

export function getSpellcastingTracks(character: Pick<Character, "className" | "level" | "classLevels" | "stats">): SpellcastingTrack[] {
  const wisdom = Math.max(3, Math.floor(Number(character.stats[4]) || 10));
  return classComponents(character).flatMap(({ className, level }) => {
    if (className === "Magic-User") return [track(className, level, "arcane", level, true, rowAt(MAGIC_USER_SLOTS, level))];
    if (className === "Illusionist") return [track(className, level, "phantasmal", level, true, rowAt(ILLUSIONIST_SLOTS, level))];
    if (className === "Cleric") return [track(className, level, "divine", level, false, rowAt(CLERIC_SLOTS, level), wisdom)];
    if (className === "Druid") return [track(className, level, "druidic", level, false, rowAt(DRUID_SLOTS, level), wisdom)];
    if (className === "Paladin" && level >= 9) return [track(className, level, "divine", Math.min(8, level - 8), false, rowAt(PALADIN_SLOTS, level))];
    if (className === "Ranger" && level >= 8) {
      const casterLevel = Math.min(6, Math.max(1, Math.floor((level - 8) / 2) + 1));
      return [
        track(className, level, "druidic", casterLevel, false, rowAt(RANGER_DRUIDIC_SLOTS, level)),
        ...(level >= 9 ? [track(className, level, "arcane", casterLevel, true, rowAt(RANGER_ARCANE_SLOTS, level))] : []),
      ];
    }
    return [];
  });
}

export function spellTrackLabel(value: SpellcastingTrack) {
  return `${value.tradition.toUpperCase()} — ${value.className.toUpperCase()} ${value.classLevel}`;
}

export function maximumSpellLevelAtClassLevel(className: string, tradition: SpellTradition, classLevel: number) {
  const fake = { className, level: classLevel, classLevels: { [className]: classLevel }, stats: ["10","10","10","10","10","10"] as Character["stats"] };
  return getSpellcastingTracks(fake).find((entry) => entry.tradition === tradition)?.baseSlots.reduce((highest, count, index) => count > 0 ? index + 1 : highest, 0) ?? 0;
}

function deterministicChoices(names: string[], count: number, seed: string) {
  let hash = Array.from(seed).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
  const available = [...names];
  const result: string[] = [];
  while (result.length < count && available.length) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const index = hash % available.length;
    result.push(available.splice(index, 1)[0]);
  }
  return result;
}

function entryId(trackId: string, key: string) {
  return `spell-${trackId.replaceAll(":", "-")}:${key}`;
}

function startingBookEntries(characterId: string, value: SpellcastingTrack): SpellbookEntry[] {
  const arcane = value.tradition === "arcane";
  const randomCount = 2;
  const randomNames = deterministicChoices(OSRIC_SPELLS[value.tradition][1] ?? [], randomCount, `${characterId}:${value.id}`);
  const randomIncludesReadMagic = arcane && randomNames.includes("Read Magic");
  const startingClassLevel = value.className === "Ranger" ? 9 : 1;
  const random = randomNames.map((name, index) => ({ id: entryId(value.id, `start-random-${index}`), name, level: 1, castingTime: 1, text: "", trackId: value.id, understood: true, acquisition: "starting-random" as const, acquisitionClassLevel: startingClassLevel, maximumSpellLevel: 1 }));
  const choiceCount = arcane ? 2 : 1;
  return [...random, ...Array.from({ length: choiceCount }, (_, index) => ({
    id: entryId(value.id, `start-choice-${index}`),
    name: arcane && index === 0 && !randomIncludesReadMagic ? "Read Magic" : "",
    level: 1,
    castingTime: 1,
    text: "",
    trackId: value.id,
    understood: true,
    acquisition: "starting-choice" as const,
    acquisitionClassLevel: startingClassLevel,
    maximumSpellLevel: 1,
  }))];
}

function levelUpEntries(value: SpellcastingTrack) {
  const firstLevel = value.className === "Ranger" ? 9 : 1;
  return Array.from({ length: Math.max(0, value.classLevel - firstLevel) }, (_, index) => {
    const gainedAt = firstLevel + index + 1;
    const maximumSpellLevel = maximumSpellLevelAtClassLevel(value.className, value.tradition, gainedAt);
    return {
      id: entryId(value.id, `level-${gainedAt}`),
      name: "",
      level: 1,
      castingTime: 1,
      text: "",
      trackId: value.id,
      understood: true,
      acquisition: "level-up" as const,
      acquisitionClassLevel: gainedAt,
      maximumSpellLevel,
    } satisfies SpellbookEntry;
  });
}

export function reconcileSpellcasting(character: Character): Character {
  const tracks = getSpellcastingTracks(character);
  if (!tracks.length) return { ...character, spellSlots: character.spellSlots.map((slot) => ({ ...slot, overCapacity: true })) };
  const bookTracks = tracks.filter((entry) => entry.usesSpellbook);
  let spellbook = character.spellbook.map((entry) => ({ ...entry }));
  for (const value of bookTracks) {
    const existingForTrack = spellbook.filter((entry) => entry.trackId === value.id);
    if (!existingForTrack.length) spellbook = [...spellbook, ...startingBookEntries(character.id, value)];
    const existingIds = new Set(spellbook.map((entry) => entry.id));
    spellbook = [...spellbook, ...levelUpEntries(value).filter((entry) => !existingIds.has(entry.id))];
  }
  const firstTrack = tracks[0];
  const normalizedExisting = character.spellSlots.map((slot) => ({ ...slot, trackId: slot.trackId ?? firstTrack.id }));
  const used = new Set<string>();
  const result: PreparedSpellSlot[] = [];
  for (const value of tracks) {
    value.slots.forEach((capacity, levelIndex) => {
      const level = levelIndex + 1;
      const existing = normalizedExisting.filter((slot) => slot.trackId === value.id && slot.level === level);
      for (let index = 0; index < capacity; index += 1) {
        const current = existing[index];
        if (current) {
          used.add(current.id);
          result.push({ ...current, overCapacity: false });
        } else {
          result.push({ id: `slot-${character.id}-${value.id}-${level}-${index + 1}`, trackId: value.id, level, spellbookId: null, preparedSpellName: null, castingTime: level, expended: false, overCapacity: false });
        }
      }
    });
  }
  for (const slot of normalizedExisting) if (!used.has(slot.id)) result.push({ ...slot, overCapacity: true });
  return { ...character, spellbook, spellSlots: result };
}

const progression: Record<string, { initial: number; thresholds: number[]; penalty: number; legal: "any" | string[]; specialization: boolean }> = {
  Assassin:{ initial:3, thresholds:[4,8,12], penalty:-3, legal:"any", specialization:false },
  Cleric:{ initial:2, thresholds:[4,7,10,13], penalty:-3, legal:["club","footmans-flail","horsemans-flail","hammer","lucern-hammer","footmans-mace","horsemans-mace","quarterstaff"], specialization:false },
  Druid:{ initial:2, thresholds:[4,7,10,13], penalty:-4, legal:["club","dagger","dart","hammer","scimitar","sling","spear","quarterstaff"], specialization:false },
  Fighter:{ initial:4, thresholds:[3,5,7,9,11,13,15,17,19], penalty:-2, legal:"any", specialization:true },
  Illusionist:{ initial:1, thresholds:[6,11,16], penalty:-5, legal:["dagger","dart","quarterstaff"], specialization:false },
  "Magic-User":{ initial:1, thresholds:[6,11,16], penalty:-5, legal:["dagger","dart","quarterstaff"], specialization:false },
  Monk:{ initial:1, thresholds:[3,5,7,9,11,13], penalty:-3, legal:["club","heavy-crossbow","light-crossbow","dagger","hand-axe","javelin","bardiche","bec-de-corbin","bill-guisarme","fauchard","fauchard-fork","military-fork","glaive","glaive-guisarme","guisarme","guisarme-voulge","halberd","lucern-hammer","partisan","awl-pike","ranseur","spetum","voulge","spear","quarterstaff","bo-stick","jo-stick"], specialization:false },
  Paladin:{ initial:3, thresholds:[5,8,11,14,17], penalty:-2, legal:"any", specialization:true },
  Ranger:{ initial:3, thresholds:[5,8,11,14,17], penalty:-2, legal:"any", specialization:true },
  Thief:{ initial:2, thresholds:[6,10,14,18], penalty:-3, legal:["club","dagger","dart","sling","scimitar","broad-sword","long-sword","short-sword"], specialization:false },
};

export function getProficiencyCapacity(character: Pick<Character, "className" | "level" | "classLevels">) {
  return Math.max(0, ...classComponents(character).map(({ className, level }) => {
    const rule = progression[className];
    return rule ? rule.initial + rule.thresholds.filter((threshold) => level >= threshold).length : 0;
  }));
}

export function getNonProficiencyPenalty(character: Pick<Character, "className" | "level" | "classLevels">) {
  return Math.max(-5, ...classComponents(character).map(({ className }) => progression[className]?.penalty ?? -5));
}

export function canSpecialize(character: Pick<Character, "className" | "level" | "classLevels">) {
  return classComponents(character).some(({ className }) => progression[className]?.specialization);
}

export function specialistClassLevel(character: Pick<Character, "className" | "level" | "classLevels">) {
  return Math.max(0, ...classComponents(character).filter(({ className }) => progression[className]?.specialization).map((entry) => entry.level));
}

export function getLegalWeaponProficiencies(character: Pick<Character, "className" | "level" | "classLevels">) {
  const components = classComponents(character);
  const legalIds = new Set(components.flatMap(({ className }) => {
    const legal = progression[className]?.legal;
    return legal === "any" ? phbWeaponRules.filter((entry) => entry.id !== "fist-open-hand").map((entry) => entry.proficiencyId) : legal ?? [];
  }));
  return [...legalIds].map((id) => weaponRulesById(id)).filter((entry): entry is WeaponRules => Boolean(entry));
}

export function specializationCost(rules: Pick<WeaponRules, "id" | "weaponType">) {
  if (rules.weaponType === "melee") return 2;
  return rules.id === "light-crossbow" || rules.id === "heavy-crossbow" ? 2 : 3;
}

export function trainingSlotsUsed(training: WeaponTrainingChoice[] | undefined) {
  return (training ?? []).reduce((total, entry) => {
    if (!entry.proficient && !entry.specialized) return total;
    const rules = weaponRulesById(entry.weaponRulesId);
    return total + (entry.specialized && rules ? specializationCost(rules) : 1);
  }, 0);
}

function legacyNames(value: string | undefined) {
  return new Set(String(value ?? "").split(/[,;\n]+/).map((entry) => entry.trim().toLowerCase()).filter(Boolean));
}

export function getWeaponTrainingState(character: Pick<Character, "weaponTraining" | "weaponProficiencies" | "weaponSpecializations">, weapon: Pick<CharacterWeapon, "name" | "weaponRulesId"> & Partial<Pick<CharacterWeapon, "proficient" | "specialized">> | null | undefined) {
  const rules = weapon?.weaponRulesId ? weaponRulesById(weapon.weaponRulesId) : weaponRulesForName(weapon?.name ?? "");
  if (!rules) return { weaponRulesId: null, proficient: false, specialized: false };
  const trainingId = rules.proficiencyId;
  const exact = (character.weaponTraining ?? []).filter((entry) => (weaponRulesById(entry.weaponRulesId)?.proficiencyId ?? entry.weaponRulesId) === trainingId);
  if (exact.length) {
    const specialized = exact.some((entry) => entry.specialized);
    return { weaponRulesId: trainingId, proficient: specialized || exact.some((entry) => entry.proficient), specialized };
  }
  const related = phbWeaponRules.filter((entry) => entry.proficiencyId === trainingId);
  const names = [trainingId, rules.proficiencyName, ...related.flatMap((entry) => [entry.id, entry.name, ...(entry.aliases ?? [])])].map((name) => name.toLowerCase());
  const proficiencies = legacyNames(character.weaponProficiencies);
  const specializations = legacyNames(character.weaponSpecializations);
  const specialized = names.some((name) => specializations.has(name));
  const legacySpecialized = specialized || Boolean(weapon?.specialized);
  return { weaponRulesId: trainingId, proficient: legacySpecialized || Boolean(weapon?.proficient) || names.some((name) => proficiencies.has(name)), specialized: legacySpecialized };
}

export function reconcileWeaponTraining(character: Character): Character {
  const merged = new Map<string, WeaponTrainingChoice>();
  for (const entry of character.weaponTraining ?? []) {
    const id = weaponRulesById(entry.weaponRulesId)?.proficiencyId ?? entry.weaponRulesId;
    const existing = merged.get(id);
    merged.set(id, { weaponRulesId: id, proficient: Boolean(existing?.proficient || existing?.specialized || entry.proficient || entry.specialized), specialized: Boolean(existing?.specialized || entry.specialized), specializationOverride: Boolean(existing?.specializationOverride || entry.specializationOverride) });
  }
  const training = [...merged.values()];
  const weapons = character.weapons.map((weapon) => {
    const state = getWeaponTrainingState({ ...character, weaponTraining: training }, weapon);
    return { ...weapon, proficient: state.proficient, specialized: state.specialized };
  });
  return { ...character, weaponTraining: training, weapons };
}

export function reconcileOsricAutomation(character: Character) {
  return reconcileWeaponTraining(reconcileSpellcasting(character));
}

export function specializedMissileRate(rules: Pick<WeaponRules, "id" | "missileRateOfFire">, specialistLevel: number, combatRound: number) {
  const base = rules.missileRateOfFire ?? 1;
  const odd = Math.max(1, Math.floor(combatRound)) % 2 === 1;
  if (rules.id === "long-bow" || rules.id === "short-bow" || rules.id === "long-composite-bow" || rules.id === "short-composite-bow") return specialistLevel >= 13 ? 4 : specialistLevel >= 7 ? 3 : base;
  if (rules.id === "light-crossbow") return specialistLevel >= 13 ? 2 : specialistLevel >= 7 && odd ? 2 : base;
  if (rules.id === "heavy-crossbow") return specialistLevel >= 13 ? (odd ? 2 : 1) : specialistLevel >= 7 ? 1 : odd ? 1 : 0;
  return base;
}
