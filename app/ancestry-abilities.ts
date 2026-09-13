export type AncestryAbility = {
  name: string;
  description: string;
  rows?: Array<[string, string]>;
};

const stalwartRows: Array<[string, string]> = [
  ["CON 4–6", "+1"],
  ["CON 7–10", "+2"],
  ["CON 11–13", "+3"],
  ["CON 14–17", "+4"],
  ["CON 18–19", "+5"],
];

export const ancestryAbilities: Record<string, AncestryAbility[]> = {
  dwarf: [
    { name: "See in the Dark", description: "60 ft infravision." },
    { name: "Giant-Slayers", description: "Giants take a −4 penalty on attacks against you." },
    { name: "Grudge-Bearers", description: "+1 to hit against goblins, half-orcs, hobgoblins, and orcs." },
    { name: "Stalwart", description: "Add the listed bonus to saves against aimed magical items, poison, spells, and magical effects.", rows: stalwartRows },
    { name: "Stone-Kenning", description: "Closely examine stonework to detect the following.", rows: [["Slopes or grades", "75%"], ["New construction", "75%"], ["Sliding or shifting rooms or walls", "65%"], ["Stonework traps", "50%"], ["Depth underground", "50%"]] },
  ],
  elf: [
    { name: "See in the Dark", description: "60 ft infravision." },
    { name: "Fey Deftness", description: "+1 to hit with pulled bows, short swords, and long swords." },
    { name: "Keen Detection", description: "While passing, detect secret or concealed objects on 1-in-6. When actively searching, detect secret objects on 1–2 and concealed objects on 1–3 on 1d6." },
    { name: "Lightfooted", description: "When unarmoured or lightly armoured and separated from non-Lightfooted allies, surprise enemies on 1–4 on 1d6. Opening a door reduces this to 1–2." },
    { name: "Strength of Will", description: "A 90% chance to ignore sleep and charm magic before any allowed saving throw." },
  ],
  gnome: [
    { name: "See in the Dark", description: "60 ft infravision." },
    { name: "Ancestral Foes", description: "+1 to hit against kobolds and goblins." },
    { name: "Giant-Slayers", description: "Giants take a −4 penalty on attacks against you." },
    { name: "Stalwart", description: "Add the listed bonus to saves against aimed magical items, poison, spells, and magical effects.", rows: stalwartRows },
    { name: "Stone-Kenning", description: "Closely examine stonework to detect the following.", rows: [["Slopes or grades", "80%"], ["Unsafe ceiling, walls, or floor", "70%"], ["Depth underground", "60%"], ["North underground", "50%"]] },
  ],
  "half-elf": [
    { name: "See in the Dark", description: "60 ft infravision." },
    { name: "Keen Detection", description: "When actively searching, detect secret objects on 1–2 and concealed objects on 1–3 on 1d6." },
    { name: "Strength of Mind", description: "A 30% chance to ignore sleep and charm magic before any allowed saving throw." },
  ],
  halfling: [
    { name: "See in the Dark", description: "60 ft infravision." },
    { name: "Halfling Marksmanship", description: "+3 to hit with any pulled bow or sling." },
    { name: "Lightfooted", description: "When unarmoured or lightly armoured and separated from non-Lightfooted allies, surprise enemies on 1–4 on 1d6. Opening a door reduces this to 1–2." },
    { name: "Stalwart", description: "Add the listed bonus to saves against aimed magical items, poison, spells, and magical effects.", rows: stalwartRows },
  ],
  "half-orc": [
    { name: "See in the Dark", description: "60 ft infravision." },
  ],
  human: [],
};

export function abilitiesForAncestry(race: string) {
  return ancestryAbilities[race.trim().toLowerCase()] ?? [];
}
