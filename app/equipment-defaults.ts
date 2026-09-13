import type { InventoryEquipment } from "./types";
import { phbWeaponRules, weaponEncumbranceUnits } from "./weapon-rules.ts";

export type EquipmentDefault = {
  id: string;
  name: string;
  aliases?: string[];
  equipment: InventoryEquipment;
  encumbranceUnits: number;
  priceGp: number;
};

const armor = (id: string, name: string, ascendingAc: number, encumbranceUnits: number, priceGp: number, aliases: string[] = []): EquipmentDefault => ({
  id,
  name,
  aliases,
  encumbranceUnits,
  priceGp,
  equipment: { kind: "armor", ascendingAc, source: "OSRIC" },
});

const shield = (id: string, name: string, encumbranceUnits: number, priceGp: number, aliases: string[] = []): EquipmentDefault => ({
  id,
  name,
  aliases,
  encumbranceUnits,
  priceGp,
  equipment: { kind: "shield", shieldBonus: 1, source: "OSRIC" },
});

export const osricEquipmentDefaults: EquipmentDefault[] = [
  ...phbWeaponRules.map((rules): EquipmentDefault => ({
    id: rules.id,
    name: rules.name,
    aliases: rules.aliases,
    encumbranceUnits: weaponEncumbranceUnits(rules),
    priceGp: rules.priceGp ?? 0,
    equipment: {
      kind: "weapon",
      weaponType: rules.weaponType,
      damage: rules.damageSM,
      damageLarge: rules.damageL,
      attackBonus: 0,
      twoHanded: rules.twoHanded,
      source: "AD&D 1e PHB",
      weaponRulesId: rules.id,
    },
  })),
  armor("banded", "Banded armor", 16, 800, 90, ["Banded armour", "Banded mail"]),
  armor("chain", "Chain mail", 15, 800, 75, ["Mail hauberk", "Mail byrnie", "Chain armor", "Chainmail"]),
  armor("elfin-chain", "Elfin chain mail", 15, 800, 0, ["Mail, elfin"]),
  armor("leather", "Leather armor", 12, 800, 5, ["Leather armour"]),
  armor("padded", "Padded gambeson", 12, 800, 4, ["Padded armor", "Padded armour"]),
  armor("plate", "Plate armor", 17, 1200, 400, ["Plate mail", "Plate armour"]),
  armor("full-plate", "Full plate", 18, 1200, 1200, ["Full plate armor", "Full plate armour"]),
  armor("ring", "Ring mail", 13, 800, 30, ["Ring armor", "Ring armour"]),
  armor("scale", "Scale armor", 14, 800, 45, ["Scale armour", "Lamellar", "Lamellar armor"]),
  armor("splint", "Splint armor", 16, 800, 80, ["Splint armour", "Splint mail"]),
  armor("studded", "Studded leather", 13, 800, 15, ["Studded armor", "Studded armour"]),
  shield("large-shield", "Large shield", 300, 15, ["Shield, large"]),
  shield("medium-shield", "Medium shield", 200, 12, ["Shield, medium"]),
  shield("small-shield", "Small shield", 100, 10, ["Shield, small", "Buckler"]),
];

export function normalizeEquipmentName(value: string) {
  return value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function equipmentDefaultForName(name: string) {
  const normalized = normalizeEquipmentName(name);
  return osricEquipmentDefaults.find((entry) => [entry.name, ...(entry.aliases ?? [])].some((alias) => normalizeEquipmentName(alias) === normalized));
}

export function equipmentArmorClassLabel(equipment: InventoryEquipment | null | undefined) {
  if (equipment?.kind === "armor" && Number.isFinite(Number(equipment.ascendingAc))) return `AC${Number(equipment.ascendingAc)}`;
  if (equipment?.kind === "shield" && Number.isFinite(Number(equipment.shieldBonus))) {
    const bonus = Number(equipment.shieldBonus);
    return `AC${bonus >= 0 ? "+" : ""}${bonus}`;
  }
  return "";
}

export function equipmentDisplayName(name: string, equipment?: InventoryEquipment | null) {
  const label = equipmentArmorClassLabel(equipment ?? equipmentDefaultForName(name)?.equipment);
  if (!label || new RegExp(`\\(${label.replace("+", "\\+")}\\)$`, "i").test(name.trim())) return name;
  return `${name} (${label})`;
}
