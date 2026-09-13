import type { CatalogItem } from "./types";
import { catalogEncumbranceFor } from "./inventory-management.ts";
import { catalogInventoryByName } from "./inventory-catalog-overrides.ts";
import { phbShoppingWeapons, weaponEncumbranceUnits, weaponRulesForName } from "./weapon-rules.ts";

const rawSiteCatalog: Array<Omit<CatalogItem, "encumbranceUnits" | "encumbranceClass">> = [
  {
    "id": "catalog-weapons-1",
    "name": "Bastard sword",
    "category": "Weapons",
    "priceGp": 30.0,
    "source": "(OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-2",
    "name": "Battle axe",
    "category": "Weapons",
    "priceGp": 7.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-3",
    "name": "Blowgun",
    "category": "Weapons",
    "priceGp": 5.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-4",
    "name": "Boar Spear",
    "category": "Weapons",
    "priceGp": 6.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-5",
    "name": "Bola",
    "category": "Weapons",
    "priceGp": 3.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-6",
    "name": "Boomerang",
    "category": "Weapons",
    "priceGp": 1.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-7",
    "name": "Broad sword",
    "category": "Weapons",
    "priceGp": 20.0,
    "source": "(OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-8",
    "name": "Bullet Crossbow",
    "category": "Weapons",
    "priceGp": 30.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-9",
    "name": "Cestus",
    "category": "Weapons",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-10",
    "name": "Chain weapon",
    "category": "Weapons",
    "priceGp": 9.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-11",
    "name": "Chain Whip",
    "category": "Weapons",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-12",
    "name": "Club",
    "category": "Weapons",
    "priceGp": 0.2,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-13",
    "name": "Composite shortbow",
    "category": "Weapons",
    "priceGp": 50.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-14",
    "name": "Dagger",
    "category": "Weapons",
    "priceGp": 4.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-15",
    "name": "Dart",
    "category": "Weapons",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-16",
    "name": "Dart / Throwing Blade",
    "category": "Weapons",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-17",
    "name": "Dead Hammer",
    "category": "Weapons",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-18",
    "name": "Defending Dagger",
    "category": "Weapons",
    "priceGp": 7.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-19",
    "name": "Falcata",
    "category": "Weapons",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-20",
    "name": "Fighting net",
    "category": "Weapons",
    "priceGp": 20.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-21",
    "name": "Flail, Footman’s",
    "category": "Weapons",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-22",
    "name": "Flail, Horseman’s",
    "category": "Weapons",
    "priceGp": 5.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-23",
    "name": "Footman's mace",
    "category": "Weapons",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-24",
    "name": "Fork / Trident",
    "category": "Weapons",
    "priceGp": 6.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-25",
    "name": "Great axe",
    "category": "Weapons",
    "priceGp": 20.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-26",
    "name": "Great Flail",
    "category": "Weapons",
    "priceGp": 12.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-27",
    "name": "Great hammer",
    "category": "Weapons",
    "priceGp": 20.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-28",
    "name": "Great mace",
    "category": "Weapons",
    "priceGp": 20.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-29",
    "name": "Greatclub",
    "category": "Weapons",
    "priceGp": 3.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-30",
    "name": "Halberd",
    "category": "Weapons",
    "priceGp": 15.0,
    "source": "(OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-31",
    "name": "Hand axe",
    "category": "Weapons",
    "priceGp": 4.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-32",
    "name": "Hand Crossbow",
    "category": "Weapons",
    "priceGp": 150.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-33",
    "name": "Hand trident",
    "category": "Weapons",
    "priceGp": 7.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-34",
    "name": "Heavy crossbow",
    "category": "Weapons",
    "priceGp": 50.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-35",
    "name": "Heavy flail",
    "category": "Weapons",
    "priceGp": 8.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-weapons-36",
    "name": "Heavy mace",
    "category": "Weapons",
    "priceGp": 8.0,
    "source": "(OSRIC3e, BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-37",
    "name": "Heavy military pick",
    "category": "Weapons",
    "priceGp": 8.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-weapons-38",
    "name": "Hook",
    "category": "Weapons",
    "priceGp": 0.6,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-39",
    "name": "Horseman's hammer",
    "category": "Weapons",
    "priceGp": 5.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-40",
    "name": "Horseman's mace",
    "category": "Weapons",
    "priceGp": 4.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-41",
    "name": "Javelin",
    "category": "Weapons",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-42",
    "name": "Lance",
    "category": "Weapons",
    "priceGp": 10.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-43",
    "name": "Lasso",
    "category": "Weapons",
    "priceGp": 3.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-44",
    "name": "Light crossbow",
    "category": "Weapons",
    "priceGp": 30.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-45",
    "name": "Light flail",
    "category": "Weapons",
    "priceGp": 6.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-weapons-46",
    "name": "Light mace",
    "category": "Weapons",
    "priceGp": 5.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-weapons-47",
    "name": "Light military pick",
    "category": "Weapons",
    "priceGp": 5.0,
    "source": "(OSRIC3e, BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-48",
    "name": "Long sword",
    "category": "Weapons",
    "priceGp": 15.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-49",
    "name": "Longbow",
    "category": "Weapons",
    "priceGp": 60.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-50",
    "name": "Morning star",
    "category": "Weapons",
    "priceGp": 7.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-51",
    "name": "Pick, Horseman’s",
    "category": "Weapons",
    "priceGp": 5.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-52",
    "name": "Pick, War",
    "category": "Weapons",
    "priceGp": 15.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-53",
    "name": "Pike",
    "category": "Weapons",
    "priceGp": 7.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-54",
    "name": "Polearm",
    "category": "Weapons",
    "priceGp": 9.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-weapons-55",
    "name": "Quarterstaff",
    "category": "Weapons",
    "priceGp": 5.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-56",
    "name": "Repeating crossbow",
    "category": "Weapons",
    "priceGp": 100.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-57",
    "name": "Sap / Blackjack",
    "category": "Weapons",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-58",
    "name": "Scimitar, Long",
    "category": "Weapons",
    "priceGp": 20.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-59",
    "name": "Scimitar, Short",
    "category": "Weapons",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-60",
    "name": "Scimitar, Two-handed",
    "category": "Weapons",
    "priceGp": 40.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-61",
    "name": "Scythe",
    "category": "Weapons",
    "priceGp": 7.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-62",
    "name": "Short sword",
    "category": "Weapons",
    "priceGp": 8.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-63",
    "name": "Shortbow",
    "category": "Weapons",
    "priceGp": 25.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-64",
    "name": "Sickle",
    "category": "Weapons",
    "priceGp": 3.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-65",
    "name": "Silver dagger",
    "category": "Weapons",
    "priceGp": 25.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-66",
    "name": "Silver Walking Stick/Staff",
    "category": "Weapons",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-weapons-67",
    "name": "Sling",
    "category": "Weapons",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-weapons-68",
    "name": "Spear",
    "category": "Weapons",
    "priceGp": 5.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-weapons-69",
    "name": "Spear, Great",
    "category": "Weapons",
    "priceGp": 7.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-70",
    "name": "Spear, Long",
    "category": "Weapons",
    "priceGp": 5.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-71",
    "name": "Spear, Short",
    "category": "Weapons",
    "priceGp": 4.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-72",
    "name": "Spiked Staff",
    "category": "Weapons",
    "priceGp": 15.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-73",
    "name": "Sword, scimitar/cutlass",
    "category": "Weapons",
    "priceGp": 15.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-weapons-74",
    "name": "Tonfa",
    "category": "Weapons",
    "priceGp": 2.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-75",
    "name": "Trident",
    "category": "Weapons",
    "priceGp": 4.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-weapons-76",
    "name": "Trident, Long",
    "category": "Weapons",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-weapons-77",
    "name": "Two-handed sword",
    "category": "Weapons",
    "priceGp": 30.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-weapons-78",
    "name": "Warhammer",
    "category": "Weapons",
    "priceGp": 7.0,
    "source": "(BFRPG-EE, H3e, OSRIC3e)"
  },
  {
    "id": "catalog-weapons-79",
    "name": "Whip",
    "category": "Weapons",
    "priceGp": 3.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-ammunition-80",
    "name": "Arrowhead",
    "category": "Ammunition",
    "priceGp": 0.05,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-ammunition-81",
    "name": "Arrows (12)",
    "category": "Ammunition",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-ammunition-82",
    "name": "Blowgun needles",
    "category": "Ammunition",
    "priceGp": 0.1,
    "source": "(H3e)"
  },
  {
    "id": "catalog-ammunition-83",
    "name": "Hand Quarrel",
    "category": "Ammunition",
    "priceGp": 0.2,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-ammunition-84",
    "name": "Heavy crossbow bolts",
    "category": "Ammunition",
    "priceGp": 4.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-ammunition-85",
    "name": "Light crossbow bolts",
    "category": "Ammunition",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-ammunition-86",
    "name": "Silver arrow",
    "category": "Ammunition",
    "priceGp": 5.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-ammunition-87",
    "name": "Silver arrowhead",
    "category": "Ammunition",
    "priceGp": 1.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-ammunition-88",
    "name": "Silver crossbow bolt",
    "category": "Ammunition",
    "priceGp": 10.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-ammunition-89",
    "name": "Silver Hand Quarrel",
    "category": "Ammunition",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-ammunition-90",
    "name": "Silver sling bullet",
    "category": "Ammunition",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-ammunition-91",
    "name": "Sling bullets",
    "category": "Ammunition",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-armor-shields-92",
    "name": "Banded mail",
    "category": "Armor & Shields",
    "priceGp": 150.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-armor-shields-93",
    "name": "Brigandine",
    "category": "Armor & Shields",
    "priceGp": 80.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-armor-shields-94",
    "name": "Buckler",
    "category": "Armor & Shields",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-armor-shields-95",
    "name": "Chain mail",
    "category": "Armor & Shields",
    "priceGp": 75.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-armor-shields-96",
    "name": "Field plate",
    "category": "Armor & Shields",
    "priceGp": 1000.0,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-armor-shields-97",
    "name": "Full plate",
    "category": "Armor & Shields",
    "priceGp": 2000.0,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-armor-shields-98",
    "name": "Helmet, Light",
    "category": "Armor & Shields",
    "priceGp": 5.0,
    "source": "(ACKS)"
  },
  {
    "id": "catalog-armor-shields-99",
    "name": "Hide armor",
    "category": "Armor & Shields",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-armor-shields-100",
    "name": "Laminated armor",
    "category": "Armor & Shields",
    "priceGp": 75.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-armor-shields-101",
    "name": "Large shield",
    "category": "Armor & Shields",
    "priceGp": 15.0,
    "source": "(OSRIC3e, H3e)"
  },
  {
    "id": "catalog-armor-shields-102",
    "name": "Leather armor",
    "category": "Armor & Shields",
    "priceGp": 15.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-armor-shields-103",
    "name": "Leather bracers",
    "category": "Armor & Shields",
    "priceGp": 0.8,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-armor-shields-104",
    "name": "Medium shield",
    "category": "Armor & Shields",
    "priceGp": 12.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-armor-shields-105",
    "name": "Padded armor",
    "category": "Armor & Shields",
    "priceGp": 10.0,
    "source": "(OSRIC3e, H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-armor-shields-106",
    "name": "Plate armor",
    "category": "Armor & Shields",
    "priceGp": 350.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-armor-shields-107",
    "name": "Ring mail",
    "category": "Armor & Shields",
    "priceGp": 30.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-armor-shields-108",
    "name": "Scale armor",
    "category": "Armor & Shields",
    "priceGp": 50.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-armor-shields-109",
    "name": "Small shield",
    "category": "Armor & Shields",
    "priceGp": 10.0,
    "source": "(OSRIC3e, H3e)"
  },
  {
    "id": "catalog-armor-shields-110",
    "name": "Splint mail",
    "category": "Armor & Shields",
    "priceGp": 100.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-armor-shields-111",
    "name": "Studded leather armor",
    "category": "Armor & Shields",
    "priceGp": 30.0,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-armor-shields-112",
    "name": "Tower Shield",
    "category": "Armor & Shields",
    "priceGp": 15.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-113",
    "name": "Archer's quiver pack",
    "category": "Containers & Carrying",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-114",
    "name": "Arrow quiver",
    "category": "Containers & Carrying",
    "priceGp": 1.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-115",
    "name": "Backpack",
    "category": "Containers & Carrying",
    "priceGp": 4.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-116",
    "name": "Barrel",
    "category": "Containers & Carrying",
    "priceGp": 2.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-117",
    "name": "Belt, Money Belt",
    "category": "Containers & Carrying",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-118",
    "name": "Bolt case",
    "category": "Containers & Carrying",
    "priceGp": 1.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-119",
    "name": "Bow case",
    "category": "Containers & Carrying",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-containers-carrying-120",
    "name": "Box",
    "category": "Containers & Carrying",
    "priceGp": 1.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-121",
    "name": "Bucket (5 gallon)",
    "category": "Containers & Carrying",
    "priceGp": 0.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-122",
    "name": "Ceramic ink pot",
    "category": "Containers & Carrying",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-123",
    "name": "Ceramic jar or bottle",
    "category": "Containers & Carrying",
    "priceGp": 0.4,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-124",
    "name": "Chest",
    "category": "Containers & Carrying",
    "priceGp": 2.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-125",
    "name": "Cloth bag",
    "category": "Containers & Carrying",
    "priceGp": 0.08,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-126",
    "name": "Coal keeper",
    "category": "Containers & Carrying",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-127",
    "name": "Glass jar or bottle",
    "category": "Containers & Carrying",
    "priceGp": 1.2,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-128",
    "name": "Glass vial",
    "category": "Containers & Carrying",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-129",
    "name": "Knapsack",
    "category": "Containers & Carrying",
    "priceGp": 3.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-130",
    "name": "Large pouch",
    "category": "Containers & Carrying",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-131",
    "name": "Large sack",
    "category": "Containers & Carrying",
    "priceGp": 0.15,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-132",
    "name": "Large waterskin (1 gallon)",
    "category": "Containers & Carrying",
    "priceGp": 3.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-133",
    "name": "Leather flask",
    "category": "Containers & Carrying",
    "priceGp": 0.1,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-134",
    "name": "Leather map or scroll case",
    "category": "Containers & Carrying",
    "priceGp": 1.0,
    "source": "(OSRIC3e, BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-containers-carrying-135",
    "name": "Metal scabbard",
    "category": "Containers & Carrying",
    "priceGp": 0.8,
    "source": "(H3e)"
  },
  {
    "id": "catalog-containers-carrying-136",
    "name": "Oilskin satchel",
    "category": "Containers & Carrying",
    "priceGp": 6.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-137",
    "name": "Pack vest",
    "category": "Containers & Carrying",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-138",
    "name": "Potion or scroll pouch",
    "category": "Containers & Carrying",
    "priceGp": 5.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-containers-carrying-139",
    "name": "Rigid map or scroll case",
    "category": "Containers & Carrying",
    "priceGp": 5.0,
    "source": "(OSRIC3e, H3e)"
  },
  {
    "id": "catalog-containers-carrying-140",
    "name": "Satchel or haversack",
    "category": "Containers & Carrying",
    "priceGp": 1.2,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-141",
    "name": "Scabbard",
    "category": "Containers & Carrying",
    "priceGp": 0.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-142",
    "name": "Scabbard, Medium",
    "category": "Containers & Carrying",
    "priceGp": 0.3,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-143",
    "name": "Secured quiver",
    "category": "Containers & Carrying",
    "priceGp": 25.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-144",
    "name": "Silver flask",
    "category": "Containers & Carrying",
    "priceGp": 20.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-145",
    "name": "Small backpack",
    "category": "Containers & Carrying",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-146",
    "name": "Small pouch",
    "category": "Containers & Carrying",
    "priceGp": 0.2,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-containers-carrying-147",
    "name": "Small sack",
    "category": "Containers & Carrying",
    "priceGp": 0.1,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-148",
    "name": "Smoking pouch",
    "category": "Containers & Carrying",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-149",
    "name": "Spell pouch",
    "category": "Containers & Carrying",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-150",
    "name": "Steel flask",
    "category": "Containers & Carrying",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-151",
    "name": "Tiny cloth bag",
    "category": "Containers & Carrying",
    "priceGp": 0.02,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-152",
    "name": "Waterskin",
    "category": "Containers & Carrying",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-153",
    "name": "Wicker backpack",
    "category": "Containers & Carrying",
    "priceGp": 0.07,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-containers-carrying-154",
    "name": "Wine bottle",
    "category": "Containers & Carrying",
    "priceGp": 2.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-containers-carrying-155",
    "name": "Wooden altar case",
    "category": "Containers & Carrying",
    "priceGp": 15.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-156",
    "name": "Alchemist’s lab",
    "category": "Tools & Kits",
    "priceGp": 500.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-157",
    "name": "Armor patch kit",
    "category": "Tools & Kits",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-158",
    "name": "Artisan tools (Basic set)",
    "category": "Tools & Kits",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-159",
    "name": "Artisan tools (Complete)",
    "category": "Tools & Kits",
    "priceGp": 50.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-160",
    "name": "Balance and Weights, Large measures (to 10lb)",
    "category": "Tools & Kits",
    "priceGp": 150.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-161",
    "name": "Bellows",
    "category": "Tools & Kits",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-162",
    "name": "Block and tackle",
    "category": "Tools & Kits",
    "priceGp": 5.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-tools-kits-163",
    "name": "Caltrops",
    "category": "Tools & Kits",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-164",
    "name": "Cauldron and tripod",
    "category": "Tools & Kits",
    "priceGp": 2.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-165",
    "name": "Chisel",
    "category": "Tools & Kits",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-tools-kits-166",
    "name": "Climbing Tools",
    "category": "Tools & Kits",
    "priceGp": 20.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-167",
    "name": "Craft Tools (Basic Set)",
    "category": "Tools & Kits",
    "priceGp": 15.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-168",
    "name": "Craft Tools (Complete)",
    "category": "Tools & Kits",
    "priceGp": 70.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-169",
    "name": "Crowbar",
    "category": "Tools & Kits",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-tools-kits-170",
    "name": "Disguise Kit",
    "category": "Tools & Kits",
    "priceGp": 20.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-171",
    "name": "Fire grate",
    "category": "Tools & Kits",
    "priceGp": 3.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-172",
    "name": "Fish hook",
    "category": "Tools & Kits",
    "priceGp": 0.1,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-173",
    "name": "Fishing Hooks (×12)",
    "category": "Tools & Kits",
    "priceGp": 0.5,
    "source": "(H3e)"
  },
  {
    "id": "catalog-tools-kits-174",
    "name": "Fishing net",
    "category": "Tools & Kits",
    "priceGp": 1.0,
    "source": "(OSRIC3e, H3e)"
  },
  {
    "id": "catalog-tools-kits-175",
    "name": "Fishing String (100-ft. ball)",
    "category": "Tools & Kits",
    "priceGp": 0.01,
    "source": "(H3e)"
  },
  {
    "id": "catalog-tools-kits-176",
    "name": "Folding / Extending rods",
    "category": "Tools & Kits",
    "priceGp": 25.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-177",
    "name": "Frying pan",
    "category": "Tools & Kits",
    "priceGp": 0.8,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-178",
    "name": "Glass cutter",
    "category": "Tools & Kits",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-179",
    "name": "Grappling hook",
    "category": "Tools & Kits",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-tools-kits-180",
    "name": "Hand Drill",
    "category": "Tools & Kits",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-181",
    "name": "Herbalist's kit",
    "category": "Tools & Kits",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-182",
    "name": "Hourglass",
    "category": "Tools & Kits",
    "priceGp": 25.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-tools-kits-183",
    "name": "Iron pot",
    "category": "Tools & Kits",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-184",
    "name": "Lens, Concave/Convex",
    "category": "Tools & Kits",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-185",
    "name": "Lens, small",
    "category": "Tools & Kits",
    "priceGp": 8.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-186",
    "name": "Lock, Excellent",
    "category": "Tools & Kits",
    "priceGp": 200.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-187",
    "name": "Lock, Good",
    "category": "Tools & Kits",
    "priceGp": 100.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-188",
    "name": "Lock, Poor",
    "category": "Tools & Kits",
    "priceGp": 20.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-189",
    "name": "Magnet, small",
    "category": "Tools & Kits",
    "priceGp": 0.1,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-190",
    "name": "Magnets, per 1\" sq",
    "category": "Tools & Kits",
    "priceGp": 0.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-191",
    "name": "Magnifying glass",
    "category": "Tools & Kits",
    "priceGp": 100.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-192",
    "name": "Manacles",
    "category": "Tools & Kits",
    "priceGp": 15.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-193",
    "name": "Mess Kit",
    "category": "Tools & Kits",
    "priceGp": 8.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-194",
    "name": "Mining pick",
    "category": "Tools & Kits",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-195",
    "name": "Needle and thread",
    "category": "Tools & Kits",
    "priceGp": 0.03,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-196",
    "name": "Needle, magnetized",
    "category": "Tools & Kits",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-197",
    "name": "Needle, sewing",
    "category": "Tools & Kits",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-tools-kits-198",
    "name": "Padlock and Key",
    "category": "Tools & Kits",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-tools-kits-199",
    "name": "Pitchfork",
    "category": "Tools & Kits",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-200",
    "name": "Piton",
    "category": "Tools & Kits",
    "priceGp": 0.2,
    "source": "(OSRIC3e, BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-201",
    "name": "Pliers",
    "category": "Tools & Kits",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-202",
    "name": "Prism",
    "category": "Tools & Kits",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-203",
    "name": "Quill knife (for sharpening quills)",
    "category": "Tools & Kits",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-204",
    "name": "Ruler, silk (30')",
    "category": "Tools & Kits",
    "priceGp": 80.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-205",
    "name": "Scissors",
    "category": "Tools & Kits",
    "priceGp": 0.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-206",
    "name": "Scribe kit",
    "category": "Tools & Kits",
    "priceGp": 15.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-207",
    "name": "Shovel",
    "category": "Tools & Kits",
    "priceGp": 2.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-208",
    "name": "Signal whistle",
    "category": "Tools & Kits",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-209",
    "name": "Skillet",
    "category": "Tools & Kits",
    "priceGp": 1.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-210",
    "name": "Slate, 1 ft sq",
    "category": "Tools & Kits",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-211",
    "name": "Slate, 4×6 ft",
    "category": "Tools & Kits",
    "priceGp": 30.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-212",
    "name": "Small bell",
    "category": "Tools & Kits",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-tools-kits-213",
    "name": "Small hammer",
    "category": "Tools & Kits",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-tools-kits-214",
    "name": "Spade",
    "category": "Tools & Kits",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-215",
    "name": "Spyglass",
    "category": "Tools & Kits",
    "priceGp": 750.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-tools-kits-216",
    "name": "Tea pot",
    "category": "Tools & Kits",
    "priceGp": 0.3,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-217",
    "name": "Thieves' tools",
    "category": "Tools & Kits",
    "priceGp": 25.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-218",
    "name": "Tinderbox",
    "category": "Tools & Kits",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-tools-kits-219",
    "name": "Tripod, cooking",
    "category": "Tools & Kits",
    "priceGp": 3.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-tools-kits-220",
    "name": "Whetstone",
    "category": "Tools & Kits",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-tools-kits-221",
    "name": "Wooden Stake",
    "category": "Tools & Kits",
    "priceGp": 0.02,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-222",
    "name": "Air Bladder",
    "category": "Camping & Travel",
    "priceGp": 15.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-223",
    "name": "Bedroll",
    "category": "Camping & Travel",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-camping-travel-224",
    "name": "Bullseye lantern",
    "category": "Camping & Travel",
    "priceGp": 14.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-camping-travel-225",
    "name": "Climbing harness",
    "category": "Camping & Travel",
    "priceGp": 15.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-226",
    "name": "Collapsing pole (10 ft.)",
    "category": "Camping & Travel",
    "priceGp": 50.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-227",
    "name": "Crampons",
    "category": "Camping & Travel",
    "priceGp": 2.0,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-228",
    "name": "Hammock",
    "category": "Camping & Travel",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-229",
    "name": "Hooded lantern",
    "category": "Camping & Travel",
    "priceGp": 7.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-camping-travel-230",
    "name": "Ladder (10 ft.)",
    "category": "Camping & Travel",
    "priceGp": 0.5,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-camping-travel-231",
    "name": "Lamp (bronze)",
    "category": "Camping & Travel",
    "priceGp": 0.1,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-camping-travel-232",
    "name": "Large party tent",
    "category": "Camping & Travel",
    "priceGp": 25.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-233",
    "name": "One-person tent",
    "category": "Camping & Travel",
    "priceGp": 3.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-234",
    "name": "Rope ladder (25 ft.)",
    "category": "Camping & Travel",
    "priceGp": 3.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-235",
    "name": "Skates",
    "category": "Camping & Travel",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-236",
    "name": "Skis",
    "category": "Camping & Travel",
    "priceGp": 15.0,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-237",
    "name": "Snowshoes",
    "category": "Camping & Travel",
    "priceGp": 20.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-camping-travel-238",
    "name": "Stakes (×4) and Wooden Mallet",
    "category": "Camping & Travel",
    "priceGp": 1.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-camping-travel-239",
    "name": "Two-person tent",
    "category": "Camping & Travel",
    "priceGp": 7.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-camping-travel-240",
    "name": "Winter blanket",
    "category": "Camping & Travel",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-camping-travel-241",
    "name": "Wooden pole (10 ft.)",
    "category": "Camping & Travel",
    "priceGp": 0.3,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-general-goods-242",
    "name": "Blank book",
    "category": "General Goods",
    "priceGp": 25.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-general-goods-243",
    "name": "Chess set",
    "category": "General Goods",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-general-goods-244",
    "name": "Crutches",
    "category": "General Goods",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-general-goods-245",
    "name": "Deck of Cards (Game, Tarot)",
    "category": "General Goods",
    "priceGp": 15.81,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-general-goods-246",
    "name": "Dice",
    "category": "General Goods",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-general-goods-247",
    "name": "Flute (wooden)",
    "category": "General Goods",
    "priceGp": 0.1,
    "source": "(H3e)"
  },
  {
    "id": "catalog-general-goods-248",
    "name": "Horn, Drinking",
    "category": "General Goods",
    "priceGp": 0.1,
    "source": "(H3e)"
  },
  {
    "id": "catalog-general-goods-249",
    "name": "Hunting horn",
    "category": "General Goods",
    "priceGp": 5.0,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-general-goods-250",
    "name": "Juggling balls or pins – set of 3",
    "category": "General Goods",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-general-goods-251",
    "name": "Loaded dice",
    "category": "General Goods",
    "priceGp": 10.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-general-goods-252",
    "name": "Marbles (bag of 20)",
    "category": "General Goods",
    "priceGp": 0.8,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-general-goods-253",
    "name": "Musical Instrument",
    "category": "General Goods",
    "priceGp": 136.93,
    "source": "(ACKS)"
  },
  {
    "id": "catalog-general-goods-254",
    "name": "Panpipes",
    "category": "General Goods",
    "priceGp": 0.5,
    "source": "(H3e)"
  },
  {
    "id": "catalog-general-goods-255",
    "name": "Rattle (wooden)",
    "category": "General Goods",
    "priceGp": 1.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-general-goods-256",
    "name": "Reference Books, per 25 pages",
    "category": "General Goods",
    "priceGp": 22.36,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-general-goods-257",
    "name": "Smoking Pipe",
    "category": "General Goods",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-general-goods-258",
    "name": "Tome, blank, per 25 pages",
    "category": "General Goods",
    "priceGp": 25.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-259",
    "name": "Adventurer's Outfit",
    "category": "Clothing & Personal",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-260",
    "name": "Apron, Canvas",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-261",
    "name": "Apron, Leather",
    "category": "Clothing & Personal",
    "priceGp": 3.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-262",
    "name": "Artisan / Craftsman Clothes",
    "category": "Clothing & Personal",
    "priceGp": 6.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-263",
    "name": "Baldric, belt sash",
    "category": "Clothing & Personal",
    "priceGp": 0.8,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-264",
    "name": "Belt, Weapon belt",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-265",
    "name": "Blouse, Linen",
    "category": "Clothing & Personal",
    "priceGp": 0.1,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-266",
    "name": "Boots",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-clothing-personal-267",
    "name": "Boots, High or Swash-topped",
    "category": "Clothing & Personal",
    "priceGp": 3.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-268",
    "name": "Boots, Riding",
    "category": "Clothing & Personal",
    "priceGp": 3.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-clothing-personal-269",
    "name": "Breeches",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-270",
    "name": "Brush / Comb",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-271",
    "name": "Buckle (for belt) - decorative",
    "category": "Clothing & Personal",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-272",
    "name": "Cape",
    "category": "Clothing & Personal",
    "priceGp": 0.5,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-273",
    "name": "Cape, Full",
    "category": "Clothing & Personal",
    "priceGp": 0.7,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-274",
    "name": "Cape, Half",
    "category": "Clothing & Personal",
    "priceGp": 0.4,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-275",
    "name": "Clerical Vestments",
    "category": "Clothing & Personal",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-276",
    "name": "Cloak pin",
    "category": "Clothing & Personal",
    "priceGp": 0.4,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-clothing-personal-277",
    "name": "Cloak, Adventurers",
    "category": "Clothing & Personal",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-278",
    "name": "Cloak, Hooded, Fine (fur, leather, silk)",
    "category": "Clothing & Personal",
    "priceGp": 50.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-279",
    "name": "Cloak, Traveling",
    "category": "Clothing & Personal",
    "priceGp": 0.8,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-280",
    "name": "Clothing, Normal (pantaloons, shirt/tunic, underclothes)",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-281",
    "name": "Clothing, Religious (surplice and cassock; gown; etc.)",
    "category": "Clothing & Personal",
    "priceGp": 5.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-282",
    "name": "Clothing, Special (buckskin outfit; fancy clothes; wool/fur winter outfit)",
    "category": "Clothing & Personal",
    "priceGp": 15.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-283",
    "name": "Cold Weather Outfit",
    "category": "Clothing & Personal",
    "priceGp": 8.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-284",
    "name": "Common cloak",
    "category": "Clothing & Personal",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-clothing-personal-285",
    "name": "Common Outfit",
    "category": "Clothing & Personal",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-286",
    "name": "Doublet",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-clothing-personal-287",
    "name": "Entertainer's Costume",
    "category": "Clothing & Personal",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-288",
    "name": "Fan, paper",
    "category": "Clothing & Personal",
    "priceGp": 0.2,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-289",
    "name": "Fine cape",
    "category": "Clothing & Personal",
    "priceGp": 25.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-290",
    "name": "Fine robe",
    "category": "Clothing & Personal",
    "priceGp": 50.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-291",
    "name": "Foot wraps",
    "category": "Clothing & Personal",
    "priceGp": 0.03,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-292",
    "name": "Fur gloves",
    "category": "Clothing & Personal",
    "priceGp": 20.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-293",
    "name": "Fur hat",
    "category": "Clothing & Personal",
    "priceGp": 10.0,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-294",
    "name": "Fur leggings",
    "category": "Clothing & Personal",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-295",
    "name": "Fur-lined coat",
    "category": "Clothing & Personal",
    "priceGp": 30.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-296",
    "name": "Gloves, Fur Lined",
    "category": "Clothing & Personal",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-297",
    "name": "Gloves, kidskin, pair",
    "category": "Clothing & Personal",
    "priceGp": 3.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-clothing-personal-298",
    "name": "Gown or Dress, common",
    "category": "Clothing & Personal",
    "priceGp": 1.2,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-299",
    "name": "Gown, linen",
    "category": "Clothing & Personal",
    "priceGp": 3.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-clothing-personal-300",
    "name": "Gown, woollen",
    "category": "Clothing & Personal",
    "priceGp": 0.5,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-clothing-personal-301",
    "name": "Hat, Cloth",
    "category": "Clothing & Personal",
    "priceGp": 0.7,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-302",
    "name": "Hat, Straw",
    "category": "Clothing & Personal",
    "priceGp": 0.02,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-303",
    "name": "Heavy boots",
    "category": "Clothing & Personal",
    "priceGp": 2.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-clothing-personal-304",
    "name": "Hood or Cowl, Wool or Linen",
    "category": "Clothing & Personal",
    "priceGp": 0.2,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-305",
    "name": "Hooded coat",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-306",
    "name": "Hose",
    "category": "Clothing & Personal",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-clothing-personal-307",
    "name": "Jacket",
    "category": "Clothing & Personal",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-308",
    "name": "Jerkin, Leather",
    "category": "Clothing & Personal",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-309",
    "name": "Jerkin, Wool or Linen",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-310",
    "name": "Kilt",
    "category": "Clothing & Personal",
    "priceGp": 3.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-311",
    "name": "Leather belt",
    "category": "Clothing & Personal",
    "priceGp": 0.6,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-clothing-personal-312",
    "name": "Leather gloves",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-313",
    "name": "Leather leggings",
    "category": "Clothing & Personal",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-314",
    "name": "Leggings",
    "category": "Clothing & Personal",
    "priceGp": 0.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-315",
    "name": "Loincloth",
    "category": "Clothing & Personal",
    "priceGp": 0.02,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-316",
    "name": "Mittens",
    "category": "Clothing & Personal",
    "priceGp": 0.3,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-317",
    "name": "Peasant Outfit",
    "category": "Clothing & Personal",
    "priceGp": 0.3,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-318",
    "name": "Perfume",
    "category": "Clothing & Personal",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-319",
    "name": "Razor",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-320",
    "name": "Ring, Signet (pewter)",
    "category": "Clothing & Personal",
    "priceGp": 5.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-clothing-personal-321",
    "name": "Robe",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-clothing-personal-322",
    "name": "Sandals",
    "category": "Clothing & Personal",
    "priceGp": 0.1,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-clothing-personal-323",
    "name": "Sash",
    "category": "Clothing & Personal",
    "priceGp": 0.2,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-324",
    "name": "Sash, Silk",
    "category": "Clothing & Personal",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-325",
    "name": "Scarf",
    "category": "Clothing & Personal",
    "priceGp": 0.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-326",
    "name": "Scented or rubbing oil",
    "category": "Clothing & Personal",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-327",
    "name": "Scholar's Robes",
    "category": "Clothing & Personal",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-328",
    "name": "Shirt or Chemise",
    "category": "Clothing & Personal",
    "priceGp": 0.8,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-329",
    "name": "Shoes",
    "category": "Clothing & Personal",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-clothing-personal-330",
    "name": "Shoes, Moccasins",
    "category": "Clothing & Personal",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-331",
    "name": "Signet ring or personal seal",
    "category": "Clothing & Personal",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-332",
    "name": "Silver mirror",
    "category": "Clothing & Personal",
    "priceGp": 25.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-clothing-personal-333",
    "name": "Skirt or Trousers",
    "category": "Clothing & Personal",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-334",
    "name": "Slippers",
    "category": "Clothing & Personal",
    "priceGp": 1.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-335",
    "name": "Soap",
    "category": "Clothing & Personal",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-clothing-personal-336",
    "name": "Soap, perfumed (per lb.)",
    "category": "Clothing & Personal",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-337",
    "name": "Steel mirror",
    "category": "Clothing & Personal",
    "priceGp": 7.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-clothing-personal-338",
    "name": "Surcoat",
    "category": "Clothing & Personal",
    "priceGp": 0.6,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-339",
    "name": "Suspenders / Braces",
    "category": "Clothing & Personal",
    "priceGp": 0.7,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-340",
    "name": "Tabard",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-341",
    "name": "Toga",
    "category": "Clothing & Personal",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-clothing-personal-342",
    "name": "Travel Clothes",
    "category": "Clothing & Personal",
    "priceGp": 8.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-343",
    "name": "Tunic",
    "category": "Clothing & Personal",
    "priceGp": 0.8,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-344",
    "name": "Tunic, woollen",
    "category": "Clothing & Personal",
    "priceGp": 0.3,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-clothing-personal-345",
    "name": "Turban",
    "category": "Clothing & Personal",
    "priceGp": 0.05,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-346",
    "name": "Veil, Silk",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-347",
    "name": "Vest, Cloth w/Pockets",
    "category": "Clothing & Personal",
    "priceGp": 0.6,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-348",
    "name": "Vest, Fur / Leather",
    "category": "Clothing & Personal",
    "priceGp": 1.2,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-349",
    "name": "Wig",
    "category": "Clothing & Personal",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-clothing-personal-350",
    "name": "Wool cap",
    "category": "Clothing & Personal",
    "priceGp": 0.1,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-consumables-materials-351",
    "name": "Acid flask",
    "category": "Consumables & Materials",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-352",
    "name": "Bandages",
    "category": "Consumables & Materials",
    "priceGp": 0.1,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-consumables-materials-353",
    "name": "Beeswax block",
    "category": "Consumables & Materials",
    "priceGp": 0.3,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-354",
    "name": "Beeswax candle",
    "category": "Consumables & Materials",
    "priceGp": 0.1,
    "source": "(OSRIC3e, H3e)"
  },
  {
    "id": "catalog-consumables-materials-355",
    "name": "Belladonna",
    "category": "Consumables & Materials",
    "priceGp": 30.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-consumables-materials-356",
    "name": "Body paint",
    "category": "Consumables & Materials",
    "priceGp": 1.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-consumables-materials-357",
    "name": "Bowstrings (10)",
    "category": "Consumables & Materials",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-358",
    "name": "Candles, 12",
    "category": "Consumables & Materials",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-359",
    "name": "Canvas (1 sq. yd.)",
    "category": "Consumables & Materials",
    "priceGp": 0.2,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-consumables-materials-360",
    "name": "Chalk",
    "category": "Consumables & Materials",
    "priceGp": 0.01,
    "source": "(H3e, OSRIC3e)"
  },
  {
    "id": "catalog-consumables-materials-361",
    "name": "Chalk (small bag)",
    "category": "Consumables & Materials",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-362",
    "name": "Charcoal sticks",
    "category": "Consumables & Materials",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-363",
    "name": "Colored chalk (small bag)",
    "category": "Consumables & Materials",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-364",
    "name": "Common chemical, drug, or herb sample",
    "category": "Consumables & Materials",
    "priceGp": 0.1,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-365",
    "name": "Cord or strap (3 ft.)",
    "category": "Consumables & Materials",
    "priceGp": 0.1,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-366",
    "name": "Exotic chemical, drug, or herb sample",
    "category": "Consumables & Materials",
    "priceGp": 50.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-367",
    "name": "Fine paper or vellum sheet",
    "category": "Consumables & Materials",
    "priceGp": 4.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-368",
    "name": "Firewood (per day)",
    "category": "Consumables & Materials",
    "priceGp": 0.01,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-consumables-materials-369",
    "name": "Glue",
    "category": "Consumables & Materials",
    "priceGp": 0.03,
    "source": "(H3e)"
  },
  {
    "id": "catalog-consumables-materials-370",
    "name": "Grease",
    "category": "Consumables & Materials",
    "priceGp": 0.02,
    "source": "(H3e)"
  },
  {
    "id": "catalog-consumables-materials-371",
    "name": "Grease (pot)",
    "category": "Consumables & Materials",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-372",
    "name": "Hemp rope (50 ft.)",
    "category": "Consumables & Materials",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-consumables-materials-373",
    "name": "Incendiary oil",
    "category": "Consumables & Materials",
    "priceGp": 35.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-consumables-materials-374",
    "name": "Ink and Quill",
    "category": "Consumables & Materials",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-consumables-materials-375",
    "name": "Iron chain (10 ft.)",
    "category": "Consumables & Materials",
    "priceGp": 30.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-consumables-materials-376",
    "name": "Iron nails (20)",
    "category": "Consumables & Materials",
    "priceGp": 0.2,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-consumables-materials-377",
    "name": "Iron spikes",
    "category": "Consumables & Materials",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-consumables-materials-378",
    "name": "Lamp oil",
    "category": "Consumables & Materials",
    "priceGp": 0.1,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-consumables-materials-379",
    "name": "Lampblack, pot",
    "category": "Consumables & Materials",
    "priceGp": 50.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-380",
    "name": "Linen twine (100 ft.)",
    "category": "Consumables & Materials",
    "priceGp": 0.2,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-consumables-materials-381",
    "name": "Mandrake, root",
    "category": "Consumables & Materials",
    "priceGp": 2.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-382",
    "name": "Nails, silver (20)",
    "category": "Consumables & Materials",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-383",
    "name": "Nightshade, sprig",
    "category": "Consumables & Materials",
    "priceGp": 1.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-384",
    "name": "Paint, per gallon",
    "category": "Consumables & Materials",
    "priceGp": 1.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-385",
    "name": "Paint, small pot",
    "category": "Consumables & Materials",
    "priceGp": 0.2,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-386",
    "name": "Parchment sheet",
    "category": "Consumables & Materials",
    "priceGp": 0.5,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-consumables-materials-387",
    "name": "Quill",
    "category": "Consumables & Materials",
    "priceGp": 0.1,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-consumables-materials-388",
    "name": "Rare chemical, drug, or herb sample",
    "category": "Consumables & Materials",
    "priceGp": 25.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-389",
    "name": "Rustproofing oil",
    "category": "Consumables & Materials",
    "priceGp": 20.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-390",
    "name": "Sealing wax",
    "category": "Consumables & Materials",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-391",
    "name": "Silk rope (50 ft.)",
    "category": "Consumables & Materials",
    "priceGp": 10.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-consumables-materials-392",
    "name": "Silk twine (100 ft.)",
    "category": "Consumables & Materials",
    "priceGp": 0.6,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-393",
    "name": "Sinew cord (100 ft.)",
    "category": "Consumables & Materials",
    "priceGp": 0.02,
    "source": "(H3e)"
  },
  {
    "id": "catalog-consumables-materials-394",
    "name": "Sword oil",
    "category": "Consumables & Materials",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-395",
    "name": "Tallow candle",
    "category": "Consumables & Materials",
    "priceGp": 0.01,
    "source": "(H3e)"
  },
  {
    "id": "catalog-consumables-materials-396",
    "name": "Uncommon chemical, drug, or herb sample",
    "category": "Consumables & Materials",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-397",
    "name": "Vellum (per sheet)",
    "category": "Consumables & Materials",
    "priceGp": 0.3,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-consumables-materials-398",
    "name": "Wire (100 ft.)",
    "category": "Consumables & Materials",
    "priceGp": 3.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-consumables-materials-399",
    "name": "Wolfsbane",
    "category": "Consumables & Materials",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-400",
    "name": "Writing ink",
    "category": "Consumables & Materials",
    "priceGp": 8.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-401",
    "name": "Writing ink (assorted color set)",
    "category": "Consumables & Materials",
    "priceGp": 20.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-consumables-materials-402",
    "name": "Writing Stick (charcoal)",
    "category": "Consumables & Materials",
    "priceGp": 0.1,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-403",
    "name": "Ale (pint)",
    "category": "Provisions",
    "priceGp": 0.1,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-provisions-404",
    "name": "Cereal (bag)",
    "category": "Provisions",
    "priceGp": 0.1,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-405",
    "name": "Cheese (brick)",
    "category": "Provisions",
    "priceGp": 0.3,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-406",
    "name": "Coarse sugar (bag)",
    "category": "Provisions",
    "priceGp": 0.3,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-407",
    "name": "Common wine (quart)",
    "category": "Provisions",
    "priceGp": 0.8,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-408",
    "name": "Cooking provisions (1 week)",
    "category": "Provisions",
    "priceGp": 3.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-provisions-409",
    "name": "Cooking spices (pouch)",
    "category": "Provisions",
    "priceGp": 5.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-410",
    "name": "Dry rations (1 week)",
    "category": "Provisions",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-provisions-411",
    "name": "Eggs (dozen)",
    "category": "Provisions",
    "priceGp": 0.06,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-412",
    "name": "Elven waybread (1 week)",
    "category": "Provisions",
    "priceGp": 35.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-provisions-413",
    "name": "Flour (sack)",
    "category": "Provisions",
    "priceGp": 0.1,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-414",
    "name": "Hard biscuits (bag)",
    "category": "Provisions",
    "priceGp": 0.1,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-415",
    "name": "Honey (crock)",
    "category": "Provisions",
    "priceGp": 1.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-416",
    "name": "Nuts (bag)",
    "category": "Provisions",
    "priceGp": 0.5,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-417",
    "name": "Salt (bag)",
    "category": "Provisions",
    "priceGp": 0.1,
    "source": "(H3e)"
  },
  {
    "id": "catalog-provisions-418",
    "name": "Standard rations (1 day)",
    "category": "Provisions",
    "priceGp": 2.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-provisions-419",
    "name": "Trail rations (1 day)",
    "category": "Provisions",
    "priceGp": 6.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-provisions-420",
    "name": "Wine (pint)",
    "category": "Provisions",
    "priceGp": 0.5,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-religious-arcane-421",
    "name": "Altar Symbol, Elaborate",
    "category": "Religious & Arcane",
    "priceGp": 250.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-422",
    "name": "Altar Symbol, Metal",
    "category": "Religious & Arcane",
    "priceGp": 50.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-423",
    "name": "Altar Symbol, Simple",
    "category": "Religious & Arcane",
    "priceGp": 0.5,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-424",
    "name": "Aspergillum",
    "category": "Religious & Arcane",
    "priceGp": 20.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-425",
    "name": "Blank spellbook",
    "category": "Religious & Arcane",
    "priceGp": 50.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-religious-arcane-426",
    "name": "Censer, brass",
    "category": "Religious & Arcane",
    "priceGp": 10.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-religious-arcane-427",
    "name": "Censer, gold",
    "category": "Religious & Arcane",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-428",
    "name": "Gold holy symbol",
    "category": "Religious & Arcane",
    "priceGp": 75.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-religious-arcane-429",
    "name": "Holy symbol flask",
    "category": "Religious & Arcane",
    "priceGp": 50.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-430",
    "name": "Holy Symbol, Ornate",
    "category": "Religious & Arcane",
    "priceGp": 50.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-431",
    "name": "Holy symbol, pewter",
    "category": "Religious & Arcane",
    "priceGp": 5.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-religious-arcane-432",
    "name": "Holy water",
    "category": "Religious & Arcane",
    "priceGp": 25.0,
    "source": "(BFRPG-EE, OSRIC3e)"
  },
  {
    "id": "catalog-religious-arcane-433",
    "name": "Incense (12 sticks)",
    "category": "Religious & Arcane",
    "priceGp": 5.0,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-434",
    "name": "Prayer beads",
    "category": "Religious & Arcane",
    "priceGp": 1.0,
    "source": "(BFRPG-EE, H3e)"
  },
  {
    "id": "catalog-religious-arcane-435",
    "name": "Prayer book",
    "category": "Religious & Arcane",
    "priceGp": 100.0,
    "source": "(H3e, BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-436",
    "name": "Ritual mask",
    "category": "Religious & Arcane",
    "priceGp": 10.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-religious-arcane-437",
    "name": "Silver holy symbol",
    "category": "Religious & Arcane",
    "priceGp": 25.0,
    "source": "(BFRPG-EE, OSRIC3e, H3e)"
  },
  {
    "id": "catalog-religious-arcane-438",
    "name": "Spell Book",
    "category": "Religious & Arcane",
    "priceGp": 100.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-439",
    "name": "Travel Altar",
    "category": "Religious & Arcane",
    "priceGp": 40.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-religious-arcane-440",
    "name": "Wooden holy symbol",
    "category": "Religious & Arcane",
    "priceGp": 0.5,
    "source": "(OSRIC3e, H3e)"
  },
  {
    "id": "catalog-religious-arcane-441",
    "name": "Wyvern ink (1 spell level)",
    "category": "Religious & Arcane",
    "priceGp": 100.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-vehicles-vessels-442",
    "name": "Amazon Carrack",
    "category": "Vehicles & Vessels",
    "priceGp": 20000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-443",
    "name": "Anchor, Iron, Boat",
    "category": "Vehicles & Vessels",
    "priceGp": 40.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-vehicles-vessels-444",
    "name": "Barge, River",
    "category": "Vehicles & Vessels",
    "priceGp": 500.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-445",
    "name": "Boat, River, Sailing",
    "category": "Vehicles & Vessels",
    "priceGp": 800.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-446",
    "name": "Boxed wagon",
    "category": "Vehicles & Vessels",
    "priceGp": 300.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-447",
    "name": "Canoe",
    "category": "Vehicles & Vessels",
    "priceGp": 150.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-448",
    "name": "Canoe, War, Large",
    "category": "Vehicles & Vessels",
    "priceGp": 8000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-449",
    "name": "Canoe, War, Small",
    "category": "Vehicles & Vessels",
    "priceGp": 2000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-450",
    "name": "Cart, 2-Wheel",
    "category": "Vehicles & Vessels",
    "priceGp": 65.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-451",
    "name": "Chariot",
    "category": "Vehicles & Vessels",
    "priceGp": 200.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-452",
    "name": "Coach, 4-wheel",
    "category": "Vehicles & Vessels",
    "priceGp": 500.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-453",
    "name": "Coaster",
    "category": "Vehicles & Vessels",
    "priceGp": 5000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-454",
    "name": "Cog",
    "category": "Vehicles & Vessels",
    "priceGp": 8000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-455",
    "name": "Covered wagon",
    "category": "Vehicles & Vessels",
    "priceGp": 250.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-456",
    "name": "Esquimaux Kayak",
    "category": "Vehicles & Vessels",
    "priceGp": 200.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-457",
    "name": "Esquimaux Umiak",
    "category": "Vehicles & Vessels",
    "priceGp": 350.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-458",
    "name": "Galley, Large",
    "category": "Vehicles & Vessels",
    "priceGp": 20000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-459",
    "name": "Galley, Small",
    "category": "Vehicles & Vessels",
    "priceGp": 10000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-460",
    "name": "Galley, War",
    "category": "Vehicles & Vessels",
    "priceGp": 30000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-461",
    "name": "Great-wheel wagon",
    "category": "Vehicles & Vessels",
    "priceGp": 750.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-462",
    "name": "Large wagon",
    "category": "Vehicles & Vessels",
    "priceGp": 250.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-vehicles-vessels-463",
    "name": "Lifeboat",
    "category": "Vehicles & Vessels",
    "priceGp": 100.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-464",
    "name": "Oar, Common",
    "category": "Vehicles & Vessels",
    "priceGp": 2.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-vehicles-vessels-465",
    "name": "Oar, Galley",
    "category": "Vehicles & Vessels",
    "priceGp": 10.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-vehicles-vessels-466",
    "name": "Open wagon",
    "category": "Vehicles & Vessels",
    "priceGp": 200.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-467",
    "name": "Paddle",
    "category": "Vehicles & Vessels",
    "priceGp": 1.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-vehicles-vessels-468",
    "name": "Raft",
    "category": "Vehicles & Vessels",
    "priceGp": 100.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-469",
    "name": "Rowboat",
    "category": "Vehicles & Vessels",
    "priceGp": 100.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-470",
    "name": "Sailcloth (100 sq. ft.)",
    "category": "Vehicles & Vessels",
    "priceGp": 20.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-vehicles-vessels-471",
    "name": "Sedan Chair",
    "category": "Vehicles & Vessels",
    "priceGp": 100.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-472",
    "name": "Small wagon",
    "category": "Vehicles & Vessels",
    "priceGp": 100.0,
    "source": "(OSRIC3e)"
  },
  {
    "id": "catalog-vehicles-vessels-473",
    "name": "Travois",
    "category": "Vehicles & Vessels",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  },
  {
    "id": "catalog-vehicles-vessels-474",
    "name": "Viking Færing",
    "category": "Vehicles & Vessels",
    "priceGp": 300.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-475",
    "name": "Viking Knarr",
    "category": "Vehicles & Vessels",
    "priceGp": 10000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-476",
    "name": "Viking Longship, Large",
    "category": "Vehicles & Vessels",
    "priceGp": 18000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-477",
    "name": "Viking Longship, Small",
    "category": "Vehicles & Vessels",
    "priceGp": 12000.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-478",
    "name": "Viking Sexæring",
    "category": "Vehicles & Vessels",
    "priceGp": 900.0,
    "source": "(H3e)"
  },
  {
    "id": "catalog-vehicles-vessels-479",
    "name": "Wagon or cart wheel",
    "category": "Vehicles & Vessels",
    "priceGp": 5.0,
    "source": "(BFRPG-EE)"
  }
];

const supplementalCatalog: Array<Omit<CatalogItem, "encumbranceUnits" | "encumbranceClass">> = [{
  id: "catalog-consumables-materials-torch",
  name: "Torch",
  category: "Consumables & Materials",
  priceGp: 0.02,
  description: "Consumable or material",
  source: "(OSRIC3e, ACKS, H3e)",
},
  { id: "catalog-animals-camel", name: "Camel", category: "Animals & Mounts", priceGp: 100, description: "Pack animal", source: "(OSRIC3e)", containerCapacityUnits: 12000, capacityBasis: "30 st carrying capacity" },
  { id: "catalog-animals-donkey", name: "Donkey", category: "Animals & Mounts", priceGp: 8, description: "Pack animal", source: "(OSRIC3e)", containerCapacityUnits: 4000, capacityBasis: "10 st carrying capacity" },
  { id: "catalog-animals-cow", name: "Cow", category: "Animals & Mounts", priceGp: 10, description: "Livestock and draft animal", source: "(OSRIC3e)", containerCapacityUnits: 4800, capacityBasis: "12 st carrying capacity" },
  { id: "catalog-animals-goat", name: "Goat", category: "Animals & Mounts", priceGp: 1, description: "Livestock and pack animal", source: "(OSRIC3e)", containerCapacityUnits: 1200, capacityBasis: "3 st carrying capacity" },
  { id: "catalog-animals-hunting-dog", name: "Hunting dog", category: "Animals & Mounts", priceGp: 20, description: "Trained hunting animal", source: "(OSRIC3e)", containerCapacityUnits: 800, capacityBasis: "2 st carrying capacity" },
  { id: "catalog-animals-war-dog", name: "War dog", category: "Animals & Mounts", priceGp: 25, description: "Trained war animal", source: "(OSRIC3e)", containerCapacityUnits: 1600, capacityBasis: "4 st carrying capacity" },
  { id: "catalog-animals-riding-elephant", name: "Riding elephant", category: "Animals & Mounts", priceGp: 1000, description: "Large trained mount", source: "(OSRIC3e)", containerCapacityUnits: 56000, capacityBasis: "140 st carrying capacity" },
  { id: "catalog-animals-war-elephant", name: "War elephant", category: "Animals & Mounts", priceGp: 4000, description: "Large trained war mount", source: "(OSRIC3e)", containerCapacityUnits: 72000, capacityBasis: "180 st carrying capacity" },
];

const travelPackCatalog: CatalogItem[] = [
  { id: "catalog-travel-provision-pack", name: "Provision Pack", category: "Travel Provisions", priceGp: 0, description: "One mixed expedition load of 10 Sacks; generated by the Travel calculator", source: "(Travel calculator)", encumbranceUnits: 4000, encumbranceClass: "sack", weightBasis: "10 Sacks × 4 Pockets = 10 st" },
];

export const GENERIC_AMMO_CATALOG_ID = "catalog-ammo";
const genericAmmoCatalog: CatalogItem[] = [
  { id: GENERIC_AMMO_CATALOG_ID, name: "Ammo", category: "Ammunition", priceGp: 1, description: "One generic bundle with 10 shots", source: "(AD&D DASH)", encumbranceUnits: 100, encumbranceClass: "pocket", weightBasis: "One 10-shot bundle: one pocket" },
];

const phbWeaponCatalog: CatalogItem[] = phbShoppingWeapons.map((rules) => {
  const legacy = rawSiteCatalog.find((item) => item.category === "Weapons" && weaponRulesForName(item.name)?.id === rules.id);
  return {
    id: legacy?.id ?? `catalog-phb-weapon-${rules.id}`,
    name: rules.name,
    category: "Weapons",
    priceGp: rules.priceGp ?? 0,
    description: "AD&D 1e Players Handbook weapon",
    source: "(AD&D 1e PHB)",
    encumbranceUnits: weaponEncumbranceUnits(rules),
    encumbranceClass: weaponEncumbranceUnits(rules) >= 400 ? "sack" : weaponEncumbranceUnits(rules) >= 100 ? "pocket" : "coin",
    weightBasis: `${rules.weightGp} gp approximate weapon weight`,
    weaponRulesId: rules.id,
  };
});

export const siteCatalog: CatalogItem[] = [
  ...[...rawSiteCatalog.filter((item) => item.category !== "Weapons" && item.category !== "Ammunition"), ...supplementalCatalog].map((item) => ({
    ...item,
    ...(catalogInventoryByName[item.name.trim().toLowerCase()] ?? catalogEncumbranceFor(item)),
  })),
  ...phbWeaponCatalog,
  ...genericAmmoCatalog,
  ...travelPackCatalog,
];
