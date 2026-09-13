export type ArmorCategory = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Weapon-vs-armour entries are stored under the PHB's descending categories.
// The dashboard presents and selects them through its ascending physical-AC scale.
export function armorCategoryToAscendingAc(category: ArmorCategory) {
  return 21 - category;
}

export function ascendingAcToArmorCategory(ascendingArmorClass: number): ArmorCategory {
  return Math.max(2, Math.min(10, Math.round(21 - ascendingArmorClass))) as ArmorCategory;
}

export type WeaponRules = {
  id: string;
  name: string;
  proficiencyId: string;
  proficiencyName: string;
  aliases: string[];
  damageSM: string;
  damageL: string;
  speedFactor: number | null;
  speedFactorDisplay?: string;
  length: string;
  spaceRequired: string;
  damageType: "Bludgeoning" | "Piercing" | "Slashing" | "Piercing/Slashing" | "Bludgeoning/Piercing";
  armorAdjustments: Record<ArmorCategory, number>;
  missileArmorAdjustments?: Record<ArmorCategory, number>;
  missileMode?: "thrown" | "projectile";
  missileRateOfFire?: number;
  missileRanges?: { short: number; medium: number; long: number };
  canSetVsCharge: boolean;
  notes: string;
  weaponType: "melee" | "ranged";
  normalHands: 1 | 2;
  oneHandedAtStrength?: number;
  allowsOptionalTwoHanded: boolean;
  /** Compatibility field for saved equipment and older callers. */
  twoHanded: boolean;
  priceGp: number | null;
  weightGp: number;
  shopping: boolean;
};

type WeaponInput = Omit<WeaponRules, "aliases" | "armorAdjustments" | "canSetVsCharge" | "notes" | "normalHands" | "oneHandedAtStrength" | "allowsOptionalTwoHanded" | "twoHanded" | "shopping" | "proficiencyId" | "proficiencyName"> & {
  aliases?: string[];
  proficiencyId?: string;
  proficiencyName?: string;
  armor: [number, number, number, number, number, number, number, number, number];
  missileArmor?: [number, number, number, number, number, number, number, number, number];
  canSetVsCharge?: boolean;
  notes?: string;
  normalHands?: 1 | 2;
  oneHandedAtStrength?: number;
  allowsOptionalTwoHanded?: boolean;
  twoHanded?: boolean;
  shopping?: boolean;
};

const categories: ArmorCategory[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const ac = (values: WeaponInput["armor"]) => Object.fromEntries(categories.map((category, index) => [category, values[index]])) as Record<ArmorCategory, number>;

function weapon(input: WeaponInput): WeaponRules {
  const normalHands = input.normalHands ?? (input.twoHanded ? 2 : 1);
  return {
    ...input,
    proficiencyId: input.proficiencyId ?? input.id,
    proficiencyName: input.proficiencyName ?? input.name,
    aliases: input.aliases ?? [],
    armorAdjustments: ac(input.armor),
    missileArmorAdjustments: input.missileArmor ? ac(input.missileArmor) : undefined,
    canSetVsCharge: input.canSetVsCharge ?? false,
    notes: input.notes ?? "",
    normalHands,
    oneHandedAtStrength: input.oneHandedAtStrength,
    allowsOptionalTwoHanded: input.allowsOptionalTwoHanded ?? false,
    twoHanded: normalHands === 2,
    shopping: input.shopping ?? true,
  };
}

// Rules data is transcribed from the AD&D 1e Players Handbook pp. 37–38.
// Individual initiative, engagement-gated extra attacks, and natural speed
// categories are dashboard adaptations and intentionally live outside this data.
export const phbWeaponRules: WeaponRules[] = [
  weapon({ id: "battle-axe", name: "Battle axe", aliases: ["Axe, battle"], damageSM: "1d8", damageL: "1d8", speedFactor: 7, length: "c. 4 ft", spaceRequired: "4 ft", damageType: "Slashing", armor: [-3,-1,1,-1,0,0,1,1,2], weaponType: "melee", normalHands: 2, oneHandedAtStrength: 15, priceGp: 5, weightGp: 75 }),
  weapon({ id: "hand-axe", name: "Hand axe", aliases: ["Axe, hand", "Axe, hand or throwing", "Throwing axe"], damageSM: "1d6", damageL: "1d4", speedFactor: 4, length: "c. 1½ ft", spaceRequired: "1 ft", damageType: "Slashing", armor: [-3,-2,-2,-1,0,0,1,1,1], missileArmor: [-4,-3,-2,-1,-1,0,0,0,1], missileMode: "thrown", missileRateOfFire: 1, missileRanges: { short: 1, medium: 2, long: 3 }, weaponType: "melee", priceGp: 1, weightGp: 50 }),
  weapon({ id: "bardiche", name: "Bardiche", damageSM: "2d4", damageL: "3d4", speedFactor: 9, length: "c. 5 ft", spaceRequired: "5 ft", damageType: "Slashing", armor: [-2,-1,0,0,1,1,2,2,3], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 7, weightGp: 125 }),
  weapon({ id: "bec-de-corbin", name: "Bec de corbin", aliases: ["Bec de Corbin"], damageSM: "1d8", damageL: "1d6", speedFactor: 9, length: "c. 6 ft", spaceRequired: "6 ft", damageType: "Piercing", armor: [2,2,2,0,0,0,0,0,-1], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 6, weightGp: 100 }),
  weapon({ id: "bill-guisarme", name: "Bill-guisarme", aliases: ["Bill-Guisarme", "Scorpion"], damageSM: "2d4", damageL: "1d10", speedFactor: 10, length: "8+ ft", spaceRequired: "2 ft", damageType: "Piercing/Slashing", armor: [0,0,0,0,0,0,1,0,0], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 6, weightGp: 150 }),
  weapon({ id: "bo-stick", name: "Bo stick", damageSM: "1d6", damageL: "1d3", speedFactor: 3, length: "c. 5 ft", spaceRequired: "3 ft", damageType: "Bludgeoning", armor: [-9,-7,-5,-3,-1,0,1,0,3], weaponType: "melee", twoHanded: true, priceGp: null, weightGp: 15, shopping: false }),
  weapon({ id: "club", name: "Club", damageSM: "1d6", damageL: "1d3", speedFactor: 4, length: "c. 3 ft", spaceRequired: "1–3 ft", damageType: "Bludgeoning", armor: [-5,-4,-3,-2,-1,-1,0,0,1], missileArmor: [-7,-5,-3,-2,-1,-1,-1,0,0], missileMode: "thrown", missileRateOfFire: 1, missileRanges: { short: 1, medium: 2, long: 3 }, weaponType: "melee", priceGp: 0.02, weightGp: 30 }),
  weapon({ id: "dagger", name: "Dagger", aliases: ["Dagger and scabbard", "Knife"], damageSM: "1d4", damageL: "1d3", speedFactor: 2, length: "c. 15 in", spaceRequired: "1 ft", damageType: "Piercing/Slashing", armor: [-3,-3,-2,-2,0,0,1,1,3], missileArmor: [-5,-4,-3,-2,-1,-1,0,0,1], missileMode: "thrown", missileRateOfFire: 2, missileRanges: { short: 1, medium: 2, long: 3 }, weaponType: "melee", priceGp: 2, weightGp: 10 }),
  weapon({ id: "fauchard", name: "Fauchard", damageSM: "1d6", damageL: "1d8", speedFactor: 8, length: "8+ ft", spaceRequired: "2 ft", damageType: "Slashing", armor: [-2,-2,-1,-1,0,0,0,-1,-1], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 3, weightGp: 60 }),
  weapon({ id: "fauchard-fork", name: "Fauchard-fork", aliases: ["Fauchard — Fork", "Fauchard Fork"], damageSM: "1d8", damageL: "1d10", speedFactor: 8, length: "8 ft", spaceRequired: "2 ft", damageType: "Piercing/Slashing", armor: [-1,-1,-1,0,0,0,1,0,1], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 8, weightGp: 80 }),
  weapon({ id: "fist-open-hand", name: "Fist or open hand", aliases: ["Unarmed", "Fist", "Open hand"], damageSM: "1d2", damageL: "1d2", speedFactor: 1, length: "2+ ft", spaceRequired: "—", damageType: "Bludgeoning", armor: [-7,-5,-3,-1,0,0,2,0,4], weaponType: "melee", priceGp: null, weightGp: 0, shopping: false }),
  weapon({ id: "footmans-flail", name: "Flail, footman’s", aliases: ["Footman's flail", "Heavy flail", "Flail, Footman’s"], damageSM: "1d6+1", damageL: "2d4", speedFactor: 7, length: "c. 4 ft", spaceRequired: "6 ft", damageType: "Bludgeoning", armor: [2,2,1,2,1,1,1,1,-1], weaponType: "melee", normalHands: 2, oneHandedAtStrength: 14, priceGp: 3, weightGp: 150 }),
  weapon({ id: "horsemans-flail", name: "Flail, horseman’s", aliases: ["Horseman's flail", "Light flail", "Flail, Horseman’s"], damageSM: "1d4+1", damageL: "1d4+1", speedFactor: 6, length: "c. 2 ft", spaceRequired: "4 ft", damageType: "Bludgeoning", armor: [0,0,0,0,0,1,1,1,0], weaponType: "melee", priceGp: 8, weightGp: 35 }),
  weapon({ id: "military-fork", name: "Fork, military", aliases: ["Military fork", "Fork, Military"], damageSM: "1d8", damageL: "2d4", speedFactor: 7, length: "7+ ft", spaceRequired: "1 ft", damageType: "Piercing", armor: [-2,-2,1,0,0,1,1,0,1], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 4, weightGp: 75 }),
  weapon({ id: "glaive", name: "Glaive", aliases: ["Couteaux de Breche"], damageSM: "1d6", damageL: "1d10", speedFactor: 8, length: "8+ ft", spaceRequired: "1 ft", damageType: "Slashing", armor: [-1,-1,0,0,0,0,0,0,0], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 6, weightGp: 75 }),
  weapon({ id: "glaive-guisarme", name: "Glaive-guisarme", aliases: ["Glaive-Guisarme"], damageSM: "2d4", damageL: "2d6", speedFactor: 9, length: "8+ ft", spaceRequired: "1 ft", damageType: "Piercing/Slashing", armor: [-1,-1,0,0,0,0,0,0,0], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 10, weightGp: 100 }),
  weapon({ id: "guisarme", name: "Guisarme", aliases: ["Bill", "Bill hook"], damageSM: "2d4", damageL: "1d8", speedFactor: 8, length: "6+ ft", spaceRequired: "2 ft", damageType: "Slashing", armor: [-2,-2,-1,-1,0,0,0,-1,-1], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 5, weightGp: 80 }),
  weapon({ id: "guisarme-voulge", name: "Guisarme-voulge", aliases: ["Guisarme — Voulge", "Lochaber axe"], damageSM: "2d4", damageL: "2d4", speedFactor: 10, length: "7+ ft", spaceRequired: "2 ft", damageType: "Piercing/Slashing", armor: [-1,-1,0,1,1,1,0,0,0], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 7, weightGp: 150 }),
  weapon({ id: "halberd", name: "Halberd", damageSM: "1d10", damageL: "2d6", speedFactor: 9, length: "5+ ft", spaceRequired: "5 ft", damageType: "Piercing/Slashing", armor: [1,1,1,2,2,2,1,1,0], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 9, weightGp: 175 }),
  weapon({ id: "lucern-hammer", name: "Hammer, lucern", aliases: ["Lucern hammer", "Heavy warhammer", "Hammer, Lucern"], damageSM: "2d4", damageL: "1d6", speedFactor: 9, length: "5+ ft", spaceRequired: "5 ft", damageType: "Bludgeoning/Piercing", armor: [1,1,2,2,2,1,1,0,0], canSetVsCharge: true, weaponType: "melee", normalHands: 2, oneHandedAtStrength: 15, priceGp: 7, weightGp: 150 }),
  weapon({ id: "hammer", name: "Hammer", aliases: ["War hammer", "Light war hammer", "Horseman's hammer"], damageSM: "1d4+1", damageL: "1d4", speedFactor: 4, length: "c. 1½ ft", spaceRequired: "2 ft", damageType: "Bludgeoning", armor: [0,1,0,1,0,0,0,0,0], missileArmor: [-2,-1,0,0,0,0,0,0,1], missileMode: "thrown", missileRateOfFire: 1, missileRanges: { short: 1, medium: 2, long: 3 }, weaponType: "melee", priceGp: 1, weightGp: 50 }),
  weapon({ id: "javelin", name: "Javelin", damageSM: "1d6", damageL: "1d6", speedFactor: null, length: "—", spaceRequired: "—", damageType: "Piercing", armor: [0,0,0,0,0,0,0,0,0], missileArmor: [-5,-4,-3,-2,-1,0,1,0,1], missileMode: "thrown", missileRateOfFire: 1, missileRanges: { short: 2, medium: 4, long: 6 }, weaponType: "ranged", priceGp: 0.5, weightGp: 20 }),
  weapon({ id: "jo-stick", name: "Jo stick", damageSM: "1d6", damageL: "1d4", speedFactor: 2, length: "c. 3 ft", spaceRequired: "2 ft", damageType: "Bludgeoning", armor: [-8,-6,-4,-2,-1,0,1,0,2], weaponType: "melee", priceGp: null, weightGp: 40, shopping: false }),
  weapon({ id: "lance-light", name: "Lance, light horse", aliases: ["Lance (light horse)"], damageSM: "1d6", damageL: "1d8", speedFactor: 7, length: "10 ft", spaceRequired: "1 ft", damageType: "Piercing", armor: [-2,-2,-1,0,0,0,0,0,0], notes: "Double indicated damage from a charging mount.", weaponType: "melee", twoHanded: true, priceGp: 6, weightGp: 50 }),
  weapon({ id: "lance-medium", name: "Lance, medium horse", aliases: ["Lance", "Lance (medium horse)"], damageSM: "1d6+1", damageL: "2d6", speedFactor: 6, length: "12 ft", spaceRequired: "1 ft", damageType: "Piercing", armor: [0,1,1,1,1,0,0,0,0], notes: "Double indicated damage from a charging mount.", weaponType: "melee", twoHanded: true, priceGp: 6, weightGp: 100 }),
  weapon({ id: "lance-heavy", name: "Lance, heavy horse", aliases: ["Lance (heavy horse)"], damageSM: "3d3", damageL: "3d6", speedFactor: 8, length: "c. 14 ft", spaceRequired: "1 ft", damageType: "Piercing", armor: [3,3,2,2,2,1,1,0,0], notes: "Double indicated damage from a charging mount.", weaponType: "melee", twoHanded: true, priceGp: 6, weightGp: 150 }),
  weapon({ id: "footmans-mace", name: "Mace, footman’s", aliases: ["Footman's mace", "Heavy mace", "Mace, Footman’s"], damageSM: "1d6+1", damageL: "1d6", speedFactor: 7, length: "c. 2½ ft", spaceRequired: "4 ft", damageType: "Bludgeoning", armor: [1,1,0,0,0,0,0,1,-1], weaponType: "melee", normalHands: 2, oneHandedAtStrength: 13, priceGp: 8, weightGp: 100 }),
  weapon({ id: "horsemans-mace", name: "Mace, horseman’s", aliases: ["Horseman's mace", "Light mace", "Mace, Horseman’s"], damageSM: "1d6", damageL: "1d4", speedFactor: 6, length: "c. 1½ ft", spaceRequired: "2 ft", damageType: "Bludgeoning", armor: [1,1,0,0,0,0,0,0,0], weaponType: "melee", priceGp: 4, weightGp: 50 }),
  weapon({ id: "morning-star", name: "Morning star", aliases: ["Godentag", "Holy water sprinkler"], damageSM: "2d4", damageL: "1d6+1", speedFactor: 7, length: "c. 4 ft", spaceRequired: "5 ft", damageType: "Bludgeoning/Piercing", armor: [0,1,1,1,1,1,1,2,2], weaponType: "melee", normalHands: 2, oneHandedAtStrength: 16, priceGp: 5, weightGp: 125 }),
  weapon({ id: "partisan", name: "Partisan", aliases: ["Bohemian ear-spoon"], damageSM: "1d6", damageL: "1d6+1", speedFactor: 9, length: "7+ ft", spaceRequired: "3 ft", damageType: "Piercing/Slashing", armor: [0,0,0,0,0,0,0,0,0], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 10, weightGp: 80 }),
  weapon({ id: "footmans-pick", name: "Pick, military, footman’s", aliases: ["Footman's military pick", "Heavy military pick", "Pick, Military, footman’s"], damageSM: "1d6+1", damageL: "2d4", speedFactor: 7, length: "c. 4 ft", spaceRequired: "4 ft", damageType: "Piercing", armor: [2,2,1,1,0,-1,-1,-1,-2], weaponType: "melee", normalHands: 2, oneHandedAtStrength: 14, priceGp: 8, weightGp: 60 }),
  weapon({ id: "horsemans-pick", name: "Pick, military, horseman’s", aliases: ["Horseman's military pick", "Light military pick", "Pick, Military, horseman’s"], damageSM: "1d4+1", damageL: "1d4", speedFactor: 5, length: "c. 2 ft", spaceRequired: "2 ft", damageType: "Piercing", armor: [1,1,1,1,0,0,-1,-1,-1], weaponType: "melee", priceGp: 5, weightGp: 40 }),
  weapon({ id: "awl-pike", name: "Pike, awl", aliases: ["Awl pike", "Pike, Awl"], damageSM: "1d6", damageL: "1d12", speedFactor: 13, length: "18+ ft", spaceRequired: "1 ft", damageType: "Piercing", armor: [-1,0,0,0,0,0,0,-1,-2], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 3, weightGp: 80 }),
  weapon({ id: "ranseur", name: "Ranseur", aliases: ["Chauves souris", "Ransom", "Rhonca", "Roncie", "Runka"], damageSM: "2d4", damageL: "2d4", speedFactor: 8, length: "8+ ft", spaceRequired: "1 ft", damageType: "Piercing", armor: [-2,-1,-1,0,0,0,0,0,1], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 4, weightGp: 50 }),
  weapon({ id: "scimitar", name: "Scimitar", aliases: ["Cutlass", "Sabre", "Sickle-sword", "Tulwar"], damageSM: "1d8", damageL: "1d8", speedFactor: 4, length: "c. 3 ft", spaceRequired: "2 ft", damageType: "Slashing", armor: [-3,-2,-2,1,0,0,1,1,3], weaponType: "melee", priceGp: 15, weightGp: 40 }),
  weapon({ id: "spear", name: "Spear", damageSM: "1d6", damageL: "1d8", speedFactor: 7, speedFactorDisplay: "6–8", length: "5–13+ ft", spaceRequired: "1 ft", damageType: "Piercing", armor: [-2,-1,-1,-1,0,0,0,0,0], missileArmor: [-3,-3,-2,-2,-1,0,0,0,0], missileMode: "thrown", missileRateOfFire: 1, missileRanges: { short: 1, medium: 2, long: 3 }, canSetVsCharge: true, notes: "PHB speed factor is 6–8 by length; the dashboard uses 7 when no exact length is configured. Double damage when set against a charge.", weaponType: "melee", normalHands: 1, allowsOptionalTwoHanded: true, priceGp: 1, weightGp: 50 }),
  weapon({ id: "spetum", name: "Spetum", aliases: ["Corseque", "Korseke"], damageSM: "1d6+1", damageL: "2d6", speedFactor: 8, length: "8+ ft", spaceRequired: "1 ft", damageType: "Piercing", armor: [-2,-1,0,0,0,0,0,1,2], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 3, weightGp: 50 }),
  weapon({ id: "quarterstaff", name: "Quarterstaff", aliases: ["Staff", "Staff, quarter"], damageSM: "1d6", damageL: "1d6", speedFactor: 4, length: "6–8 ft", spaceRequired: "3 ft", damageType: "Bludgeoning", armor: [-7,-5,-3,-1,0,0,1,1,0], weaponType: "melee", twoHanded: true, priceGp: 0, weightGp: 50 }),
  weapon({ id: "bastard-sword", name: "Bastard sword", aliases: ["Sword, bastard", "Sword, bastard, & scabbard", "Claymore"], damageSM: "2d4", damageL: "2d8", speedFactor: 6, length: "c. 4½ ft", spaceRequired: "4+ ft", damageType: "Piercing/Slashing", armor: [0,0,1,1,1,1,1,1,0], notes: "Treat as long sword if used one-handed.", weaponType: "melee", normalHands: 2, oneHandedAtStrength: 15, priceGp: 25, weightGp: 100 }),
  weapon({ id: "broad-sword", name: "Broad sword", aliases: ["Sword, broad", "Sword, broad, & scabbard"], damageSM: "2d4", damageL: "1d6+1", speedFactor: 5, length: "c. 3½ ft", spaceRequired: "4 ft", damageType: "Piercing/Slashing", armor: [-3,-2,-1,0,0,1,1,1,2], weaponType: "melee", normalHands: 2, oneHandedAtStrength: 12, priceGp: 10, weightGp: 75 }),
  weapon({ id: "long-sword", name: "Long sword", aliases: ["Sword, long", "Sword, long & scabbard", "Longsword"], damageSM: "1d8", damageL: "1d12", speedFactor: 5, length: "c. 3½ ft", spaceRequired: "3 ft", damageType: "Piercing/Slashing", armor: [-2,-1,0,0,0,0,0,1,2], weaponType: "melee", priceGp: 15, weightGp: 60 }),
  weapon({ id: "short-sword", name: "Short sword", aliases: ["Sword, short", "Sword, short & scabbard", "Shortsword"], damageSM: "1d6", damageL: "1d8", speedFactor: 3, length: "c. 2 ft", spaceRequired: "1 ft", damageType: "Piercing/Slashing", armor: [-3,-2,-1,0,0,0,1,0,2], weaponType: "melee", priceGp: 8, weightGp: 35 }),
  weapon({ id: "two-handed-sword", name: "Two-handed sword", aliases: ["Sword, two-handed", "Great sword", "Greatsword"], damageSM: "1d10", damageL: "3d6", speedFactor: 10, length: "c. 6 ft", spaceRequired: "6 ft", damageType: "Slashing", armor: [2,2,2,2,3,3,3,1,0], weaponType: "melee", twoHanded: true, priceGp: 30, weightGp: 250 }),
  weapon({ id: "trident", name: "Trident", aliases: ["Fork / Trident"], damageSM: "1d6+1", damageL: "3d4", speedFactor: 7, speedFactorDisplay: "6–8", length: "4–8+ ft", spaceRequired: "1 ft", damageType: "Piercing", armor: [-3,-2,-1,-1,0,0,1,0,1], canSetVsCharge: true, notes: "PHB speed factor is 6–8 by length; the dashboard uses 7 when no exact length is configured.", weaponType: "melee", normalHands: 2, oneHandedAtStrength: 14, priceGp: 4, weightGp: 50 }),
  weapon({ id: "voulge", name: "Voulge", damageSM: "2d4", damageL: "2d4", speedFactor: 10, length: "8+ ft", spaceRequired: "2 ft", damageType: "Slashing", armor: [-1,-1,0,1,1,1,0,0,0], canSetVsCharge: true, weaponType: "melee", twoHanded: true, priceGp: 2, weightGp: 125 }),
  weapon({ id: "long-composite-bow", name: "Composite long bow", aliases: ["Bow, composite, long", "Long composite bow", "Composite longbow"], damageSM: "1d6", damageL: "1d6", speedFactor: null, length: "—", spaceRequired: "—", damageType: "Piercing", armor: [-2,-1,0,0,1,2,2,3,3], missileMode: "projectile", missileRateOfFire: 2, missileRanges: { short: 6, medium: 12, long: 21 }, weaponType: "ranged", twoHanded: true, priceGp: 100, weightGp: 80 }),
  weapon({ id: "short-composite-bow", name: "Composite short bow", aliases: ["Bow, composite, short", "Short composite bow", "Composite shortbow"], damageSM: "1d6", damageL: "1d6", speedFactor: null, length: "—", spaceRequired: "—", damageType: "Piercing", armor: [-3,-3,-1,0,1,2,2,2,3], missileMode: "projectile", missileRateOfFire: 2, missileRanges: { short: 5, medium: 10, long: 18 }, weaponType: "ranged", twoHanded: true, priceGp: 75, weightGp: 50 }),
  weapon({ id: "long-bow", name: "Long bow", aliases: ["Bow, long", "Longbow"], damageSM: "1d6", damageL: "1d6", speedFactor: null, length: "—", spaceRequired: "—", damageType: "Piercing", armor: [-1,0,0,1,2,3,3,3,3], missileMode: "projectile", missileRateOfFire: 2, missileRanges: { short: 7, medium: 14, long: 21 }, weaponType: "ranged", twoHanded: true, priceGp: 60, weightGp: 80 }),
  weapon({ id: "short-bow", name: "Short bow", aliases: ["Bow, short", "Shortbow"], damageSM: "1d6", damageL: "1d6", speedFactor: null, length: "—", spaceRequired: "—", damageType: "Piercing", armor: [-5,-4,-1,0,0,1,2,2,2], missileMode: "projectile", missileRateOfFire: 2, missileRanges: { short: 5, medium: 10, long: 15 }, weaponType: "ranged", twoHanded: true, priceGp: 15, weightGp: 50 }),
  weapon({ id: "heavy-crossbow", name: "Heavy crossbow", aliases: ["Crossbow, heavy"], damageSM: "1d6+1", damageL: "1d6+1", speedFactor: null, length: "—", spaceRequired: "—", damageType: "Piercing", armor: [-1,0,1,2,3,3,4,4,4], missileMode: "projectile", missileRateOfFire: 0.5, missileRanges: { short: 8, medium: 16, long: 24 }, weaponType: "ranged", twoHanded: true, priceGp: 20, weightGp: 80 }),
  weapon({ id: "light-crossbow", name: "Light crossbow", aliases: ["Crossbow, light"], damageSM: "1d4+1", damageL: "1d4+1", speedFactor: null, length: "—", spaceRequired: "—", damageType: "Piercing", armor: [-2,-1,0,0,1,2,3,3,3], missileMode: "projectile", missileRateOfFire: 1, missileRanges: { short: 6, medium: 12, long: 18 }, weaponType: "ranged", twoHanded: true, priceGp: 12, weightGp: 50 }),
  weapon({ id: "dart", name: "Dart", damageSM: "1d3", damageL: "1d2", speedFactor: null, length: "—", spaceRequired: "—", damageType: "Piercing", armor: [-5,-4,-3,-2,-1,0,1,0,1], missileMode: "thrown", missileRateOfFire: 3, missileRanges: { short: 1.5, medium: 3, long: 4.5 }, weaponType: "ranged", priceGp: 0.25, weightGp: 5 }),
  weapon({ id: "sling", name: "Sling", aliases: ["Sling with bullets", "Sling with stones", "Sling & Bullets, dozen", "Sling (bullet)", "Sling (stone)"], damageSM: "1d4+1", damageL: "1d6+1", speedFactor: null, length: "—", spaceRequired: "—", damageType: "Bludgeoning", armor: [-2,-2,-1,0,0,0,2,1,3], missileMode: "projectile", missileRateOfFire: 1, missileRanges: { short: 5, medium: 10, long: 20 }, weaponType: "ranged", priceGp: 0.75, weightGp: 20 }),
];

export const phbShoppingWeapons = phbWeaponRules.filter((entry) => entry.shopping && entry.priceGp !== null);
const equipmentById = new Map(phbWeaponRules.map((entry) => [entry.id, entry]));
const slingRules = equipmentById.get("sling");
if (slingRules) {
  // Saved campaigns from the former split Sling implementation resolve to the
  // one canonical weapon/proficiency without changing the item instance.
  equipmentById.set("sling-bullet", slingRules);
  equipmentById.set("sling-stone", slingRules);
}
const proficiencyById = new Map<string, WeaponRules>();
for (const entry of phbWeaponRules) if (!proficiencyById.has(entry.proficiencyId)) proficiencyById.set(entry.proficiencyId, entry.proficiencyId === entry.id ? entry : { ...entry, id: entry.proficiencyId, name: entry.proficiencyName, aliases: [] });
const byId = new Map([...equipmentById, ...proficiencyById]);

export function normalizeWeaponName(value: string) {
  return value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const byName = new Map(phbWeaponRules.flatMap((entry) => [entry.name, ...entry.aliases].map((name) => [normalizeWeaponName(name), entry] as const)));

export function weaponRulesById(id: string | null | undefined) {
  return id ? byId.get(id) ?? null : null;
}

export function weaponRulesForName(name: string | null | undefined) {
  return name ? byName.get(normalizeWeaponName(name)) ?? null : null;
}

export function weaponRulesForItem(item: { name?: string; weaponRulesId?: string | null } | null | undefined) {
  return weaponRulesById(item?.weaponRulesId) ?? weaponRulesForName(item?.name);
}

type StrengthCarrier = { stats?: readonly (string | number)[] } | null | undefined;
type HandedWeapon = Partial<Pick<WeaponRules, "id" | "name" | "normalHands" | "oneHandedAtStrength" | "allowsOptionalTwoHanded" | "twoHanded">> & { weaponRulesId?: string | null };

function handednessRulesForItem(item: HandedWeapon | null | undefined) {
  if (!item) return null;
  if (item.normalHands === 1 || item.normalHands === 2) return item;
  return weaponRulesForItem({ name: item.name, weaponRulesId: item.weaponRulesId ?? item.id });
}

/** Canonical hand requirement for a weapon at the character's current STR. */
export function getHandsRequired(item: HandedWeapon | null | undefined, character?: StrengthCarrier): 1 | 2 {
  const rules = handednessRulesForItem(item);
  if (!rules) return item?.twoHanded ? 2 : 1;
  const normalHands = rules.normalHands ?? (rules.twoHanded ? 2 : 1);
  const threshold = rules.oneHandedAtStrength;
  const strength = Number(character?.stats?.[0]);
  if (normalHands === 2 && threshold && Number.isFinite(strength) && strength >= threshold) return 1;
  return normalHands;
}

/** Contextual copy used by inventory, equipment, and rules surfaces. */
export function weaponHandednessHint(item: HandedWeapon | null | undefined, character?: StrengthCarrier) {
  const rules = handednessRulesForItem(item);
  if (!rules) return "";
  if (rules.allowsOptionalTwoHanded) return "1H or 2H";
  if (!rules.oneHandedAtStrength) return "";
  return getHandsRequired(rules, character) === 1
    ? `1H — STR ${rules.oneHandedAtStrength}+ requirement met`
    : `2H normally · 1H at STR ${rules.oneHandedAtStrength}+`;
}

export function weaponProficiencyId(item: Pick<WeaponRules, "id" | "proficiencyId"> | { weaponRulesId?: string | null; name?: string } | null | undefined) {
  if (!item) return null;
  const rules = "id" in item ? weaponRulesById(item.id) : weaponRulesForItem(item);
  return rules?.proficiencyId ?? null;
}

export function weaponCanMakeMissileAttack(item: { name?: string; weaponRulesId?: string | null; category?: "melee" | "ranged" | "other" } | null | undefined) {
  const rules = weaponRulesForItem(item);
  return item?.category === "ranged" || Boolean(rules?.missileMode);
}

export function weaponIsThrown(item: { name?: string; weaponRulesId?: string | null } | null | undefined) {
  return weaponRulesForItem(item)?.missileMode === "thrown";
}

export function weaponEncumbranceUnits(rules: WeaponRules) {
  if (rules.weightGp <= 5) return 1;
  if (rules.weightGp <= 20) return 100;
  if (rules.weightGp <= 50) return 200;
  return 400;
}
