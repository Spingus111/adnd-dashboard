export type SaveBlock = {
  death: number;
  wands: number;
  polymorph: number;
  breath: number;
  spells: number;
};

export type DiceMacro = {
  name: string;
  expression: string;
};

export type CharacterWeapon = {
  id: string;
  name: string;
  attackBonus: number;
  damage: string;
  notes: string;
  category: "melee" | "ranged" | "other";
  specialized: boolean;
  proficient?: boolean;
  sourceInventoryStackId?: string | null;
  weaponRulesId?: string | null;
};

export type CharacterInventoryLine = {
  id: string;
  name: string;
  info: string;
  quantity: number;
};

export type SpellbookEntry = {
  id: string;
  name: string;
  level: number;
  castingTime: number;
  text: string;
  trackId?: string;
  understood?: boolean;
  acquisition?: "starting-random" | "starting-choice" | "level-up" | "copied";
  acquisitionClassLevel?: number;
  maximumSpellLevel?: number;
};

export type PreparedSpellSlot = {
  id: string;
  level: number;
  spellbookId: string | null;
  expended: boolean;
  trackId?: string;
  preparedSpellName?: string | null;
  castingTime?: number;
  overCapacity?: boolean;
};

export type WeaponTrainingChoice = {
  weaponRulesId: string;
  proficient: boolean;
  specialized: boolean;
  specializationOverride?: boolean;
};

export type HandState =
  | "one-hand-shield"
  | "one-hand-light"
  | "one-hand-missile"
  | "one-hand-empty"
  | "one-hand-offhand"
  | "two-hand-melee"
  | "two-hand-ranged"
  | "unarmed";

export type Character = {
  id: string;
  campaignId: string;
  folderId?: string | null;
  name: string;
  player: string;
  race: string;
  alignment?: "Lawful Good" | "Neutral Good" | "Chaotic Good" | "Lawful Neutral" | "True Neutral" | "Chaotic Neutral";
  className: string;
  level: number;
  movementRate: number;
  toHit: number;
  armorClass: number;
  baseArmorClass?: number;
  armorClassOverride?: number | null;
  currentHp: number;
  maxHp: number;
  hitDice: string;
  currentXp: number;
  totalXp: number;
  age: string;
  height: string;
  weight: string;
  tileColor: string;
  emoji: string;
  stats: [string, string, string, string, string, string];
  /** Persisted d100 roll for OSRIC extraordinary Strength; 100 is effective Strength 19. */
  exceptionalStrength?: number | null;
  rawStats?: [string, string, string, string, string, string];
  statPool?: number[];
  statRolls?: number[][];
  statAssignmentComplete?: boolean;
  /** Character-generation checkpoint: ability allocation has been confirmed. */
  scoresLocked?: boolean;
  /** Character-generation checkpoint: ancestry has been confirmed. */
  raceLocked?: boolean;
  /** Character-generation checkpoint: starting HP has been rolled into current/max HP. */
  startingHpRolled?: boolean;
  gold: number;
  saves: SaveBlock;
  notes: string;
  /** Player-authored additions shown with the character's ancestry abilities. */
  abilityNotes?: string;
  diceMacros: [DiceMacro, DiceMacro, DiceMacro];
  weapons: CharacterWeapon[];
  equippedWeaponId: string | null;
  handState: HandState;
  inventoryLines: CharacterInventoryLine[];
  weaponProficiencies: string;
  weaponSpecializations: string;
  weaponTraining?: WeaponTrainingChoice[];
  weaponTrainingLocked?: boolean;
  /** Persisted generation milestone; the value of starting money lives only in inventory coin stacks. */
  startingInventoryGranted?: boolean;
  /** Persisted generation milestone for proficient/specialized weapon grants. */
  startingWeaponsGranted?: boolean;
  classLevels?: Record<string, number>;
  spellbook: SpellbookEntry[];
  spellSlots: PreparedSpellSlot[];
  psionics?: PsionicsSetup;
};

export type CharacterFolder = {
  id: string;
  campaignId: string;
  name: string;
  color: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  valueGp: number | null;
  treasure: boolean;
  addedSession: number;
};

export type DiscardedItem = {
  id: string;
  item: InventoryItem;
  disposition: "sold" | "dropped";
  creditedGp: number;
  discardedSession: number;
  physicalStack?: InventoryStack | null;
};

export type DiscardedCharacter = {
  id: string;
  character: Character;
  discardedAt: number;
};

export type CatalogItem = {
  id: string;
  name: string;
  category: string;
  priceGp: number;
  description?: string;
  source?: string;
  encumbranceUnits: number;
  encumbranceClass: EncumbranceClass;
  weightBasis?: string;
  containerCapacityUnits?: number;
  capacityBasis?: string;
  weaponRulesId?: string | null;
};

export type EncumbranceClass = "coin" | "pocket" | "sack" | "bulky" | "container";
export type CatalogInventoryOverride = {
  encumbranceUnits: number;
  encumbranceClass: EncumbranceClass;
  weightBasis?: string;
  containerCapacityUnits?: number;
  capacityBasis?: string;
};
export type PhysicalItemKind = "normal" | "treasure";
export type InventoryOwnerType = "character" | "npc" | "animal" | "vehicle" | "other";

export type PhysicalInventoryOwner = {
  id: string;
  campaignId: string;
  name: string;
  type: InventoryOwnerType;
  capacityUnits: number;
  characterId?: string | null;
  notes?: string;
};

export type StableNpcTemplateId =
  | "heavy-foot"
  | "light-foot"
  | "archer"
  | "crossbowman"
  | "pikeman"
  | "sergeant"
  | "torchbearer"
  | "porter"
  | "mule"
  | "horse"
  | "ox"
  | "dog";

export type StableNpc = {
  id: string;
  campaignId: string;
  templateId: StableNpcTemplateId;
  subtypeId: string | null;
  name: string;
  token: string;
  currentHp: number;
  maxHp: number;
  hitDice: string;
  attackBonus: number;
  armorClass: number;
  armorMode: "natural" | "worn";
  armorProfile: SegmentedParticipant["armorProfile"];
  movementRate: number;
  size: "small" | "medium" | "large";
  morale: number | null;
  moraleImmune: boolean;
  noncombatant: boolean;
  weaponRulesIds: string[];
  equipmentRefs: Array<{ source: "equipment" | "catalog"; id: string; quantity: number }>;
  activeWeaponRulesId: string | null;
  attackMode: "natural" | "weapon";
  naturalSpeed: "fast" | "normal" | "slow";
  damageExpression: string;
  onslaughtDamage: string[];
  carryingCapacityStone: number | null;
  unarmedOverrides?: UnarmedOverrides;
  psionics?: PsionicsSetup;
  notes: string;
};

export type DiscardedStableNpc = {
  id: string;
  npc: StableNpc;
  discardedAt: number;
  inventoryDiscardId?: string | null;
};

export type StorageLocation = {
  id: string;
  campaignId: string;
  name: string;
  notes?: string;
  infiniteCapacity: true;
  hidden?: boolean;
};

export type InventoryEquipment = {
  kind: "weapon" | "armor" | "shield";
  weaponType?: "melee" | "ranged" | "other";
  damage?: string;
  damageLarge?: string;
  attackBonus?: number;
  twoHanded?: boolean;
  ascendingAc?: number;
  shieldBonus?: number;
  source?: string;
  weaponRulesId?: string | null;
};

export type InventoryWeaponTraining = {
  proficient: boolean;
  skilled: boolean;
};

export type InventoryContainer = {
  id: string;
  campaignId: string;
  name: string;
  capacityUnits: number;
  tareWeightUnits: number;
  holderType: "owner" | "location" | "container" | "ground";
  holderId: string;
  containerType: "quick-access" | "character-backpack" | "worn" | "container";
  intrinsic: boolean;
  movable: boolean;
  originCharacterId?: string | null;
  lastHolder?: string | null;
  hidden?: boolean;
  /** Links a newly bought mini-shop container to its one-click refund. */
  characterShopPurchaseUndoId?: string | null;
};

export type InventoryStack = {
  id: string;
  campaignId: string;
  catalogItemId?: string | null;
  customIdentity?: string | null;
  name: string;
  quantity: number;
  unitEncumbranceUnits: number;
  encumbranceClass: EncumbranceClass;
  itemKind: PhysicalItemKind;
  gpValue?: number | null;
  containerId?: string | null;
  locationId?: string | null;
  placement?: "incoming" | "ground" | "sell" | "payment" | "counter" | null;
  handSlot?: "main" | "offhand" | null;
  lastHolder?: string | null;
  notes?: string;
  equipment?: InventoryEquipment | null;
  trainingByCharacter?: Record<string, InventoryWeaponTraining>;
  /** Generic Ammo uses one physical item per bundle and records its remaining shots here. */
  shotsRemaining?: number | null;
  /** Missile-weapon instance flag. A true value permanently prevents another free Ammo grant. */
  initialAmmoGranted?: boolean;
  /** Links a newly bought mini-shop stack to its one-click refund. */
  characterShopPurchaseUndoId?: string | null;
};

export type CharacterShopPurchaseUndo = {
  id: string;
  characterId: string;
  campaignId: string;
  itemName: string;
  quantity: number;
  costGp: number;
  kind: "stack" | "container";
};

export type InventoryActivity = {
  id: string;
  timestamp: number;
  action: string;
  details: string[];
};

export type InventoryDiscardEntry = {
  id: string;
  kind: "stack" | "container" | "location" | "owner";
  label: string;
  discardedAt: number;
  owners: PhysicalInventoryOwner[];
  locations: StorageLocation[];
  containers: InventoryContainer[];
  stacks: InventoryStack[];
};

export type InventoryShoppingLine = {
  id: string;
  campaignId: string;
  catalogId: string | null;
  name: string;
  category: string;
  priceGp: number;
  quantity: number;
};

export type InventoryManagementState = {
  owners: PhysicalInventoryOwner[];
  locations: StorageLocation[];
  containers: InventoryContainer[];
  stacks: InventoryStack[];
  layoutPositions: Record<string, { x: number; y: number }>;
  activityLog: InventoryActivity[];
  sellVisible: boolean;
  shoppingCart: InventoryShoppingLine[];
  discarded: InventoryDiscardEntry[];
  /** The latest mini-shop purchase for each character inventory. */
  characterShopPurchaseUndoByOwnerId?: Record<string, CharacterShopPurchaseUndo>;
};

export type InitiativeResult = {
  characterId: string;
  roll: number;
  target: number;
  speed: "fast" | "slow";
};

export type DiceResult = {
  id: string;
  label: string;
  rolls: Array<number | string>;
  total: number | null;
};

export type LightSource = {
  id: string;
  type: "torch" | "lantern";
  remainingMinutes: number;
  maximumMinutes: number;
};

export type EncounterCheck = {
  id: string;
  crawlNumber: number;
  dieSize: number;
  roll: number | null;
  encounter: boolean;
  forced?: boolean;
  rest?: boolean;
  mode?: "dungeon" | "open";
  tableDieSize?: number;
  tableRoll?: number;
  /** Legacy fields retained so older saved encounter records still render. */
  numberDieSize?: number;
  numberRoll?: number;
  reactionRolls?: [number, number];
  reactionTotal?: number;
  reaction?: string;
  distanceRolls?: number[];
  distanceDieSize?: number;
  distanceModifier?: number;
  distanceSurprised?: boolean;
  distance?: number;
  distanceUnit?: "feet" | "yards";
  foesSurpriseRoll?: number;
  partySurpriseRoll?: number;
  foesSurpriseChance?: number;
  partySurpriseChance?: number;
  restDue?: boolean;
  dark?: boolean;
};

export type XpEnemy = {
  id: string;
  name: string;
  hitDice: string;
  hitPoints: number;
  specialAbilities: number;
  exceptionalAbilities: number;
  xp: number;
};

export type RecentEnemyType = {
  id: string;
  name: string;
  hitDice: string;
  typicalHp: number;
  specialAbilities: number;
  exceptionalAbilities: number;
};

export type XpTrackerState = {
  enemies: XpEnemy[];
  treasureGp: number;
  treasureXpAwardedItemValues: Record<string, number>;
  roomsExplored: number;
  otherXp: number;
  shareWeights: Record<string, number>;
  primeXpBonuses: Record<string, boolean>;
  recentEnemies: RecentEnemyType[];
};

export type SegmentedAction =
  | ""
  | "move"
  | "charge"
  | "close"
  | "close-hurl"
  | "flee"
  | "melee"
  | "hand-2-melee"
  | "two-weapon-melee"
  | "spec-melee"
  | "heroic-assault"
  | "melee-combination"
  | "missile"
  | "spec-ranged"
  | "negotiate"
  | "parry"
  | "parry-disengage"
  | "set-charge"
  | "spell"
  | "spell-like-effect"
  | "use-magic"
  | "switch-weapon"
  | "three-piece"
  | "brawl"
  | "grapple"
  | "overbear"
  | "maintain-hold"
  | "improve-hold"
  | "release-hold"
  | "small-weapon"
  | "natural-attack"
  | "stand-up"
  | "unconscious"
  | "die"
  | "hold"
  | "skip"
  | "inventory"
  | "other"
  | "psionic-combat";

export type CombatEventResolution = {
  eventKey: string;
  targetId: string | null;
  attackRoll: number | null;
  attackModifier: number;
  targetArmorClass: number | null;
  requiredRoll: number | null;
  hit: boolean | null;
  automaticHit?: boolean;
  missileMissOutcome?: "wide" | "stray" | null;
  missileOriginalTargetId?: string | null;
  headshotRoll?: number | null;
  headshot?: boolean;
  damageExpression: string;
  damageRoll: number | null;
  damageTotal: number | null;
  damageApplied: boolean;
  forcedSave: keyof SaveBlock | null;
  saveRoll: number | null;
  saveTarget: number | null;
  saveModifier?: number;
  saveSuccess: boolean | null;
  areaDamage: Array<{ targetId: string; roll: number; total: number; applied: boolean }>;
};

export type MonsterOnslaughtAttack = {
  id: string;
  timing: "segment-1" | "rolled" | "segment-10";
  damageExpression: string;
  rolledSegment: number | null;
};

export type UnarmedOverrides = {
  hitTargetNumber: number | null;
  hitAttackModifier: number | null;
  hitDefenseModifier: number | null;
  overbearAttackModifier: number | null;
  overbearDefenseModifier: number | null;
  grappleAttackModifier: number | null;
  grappleDefenseModifier: number | null;
  magicArmorBonus: number | null;
  cannotGrapple: boolean;
  cannotBeGrappled: boolean;
  cannotOverbear: boolean;
  cannotBeOverborne: boolean;
  immuneTemporaryDamage: boolean;
  fourLegged: boolean;
  appendages: number;
};

export type PsionicAttackMode = "Psionic Blast" | "Mind Thrust" | "Ego Whip" | "Id Insinuation" | "Psychic Crush";
export type PsionicDefenseMode = "Mind Blank" | "Thought Shield" | "Mental Barrier" | "Intellect Fortress" | "Tower of Iron Will";

export type PsionicsSetup = {
  enabled: boolean;
  determination: "unresolved" | "ineligible" | "failed" | "rolled" | "forced" | "established";
  potentialRoll: number | null;
  potentialModifier: number;
  psionicStrengthRoll: number | null;
  psionicStrength: number;
  originalPsionicAbility: number;
  currentAttackPoints: number;
  maxAttackPoints: number;
  currentDefensePoints: number;
  maxDefensePoints: number;
  attackModes: PsionicAttackMode[];
  defenseModes: PsionicDefenseMode[];
  attackModeRoll: number | null;
  defenseModeRoll: number | null;
  disciplineRoll: number | null;
  disciplines: PsionicDiscipline[];
  forced?: boolean;
};

export type PsionicDiscipline = {
  id: string;
  name: string;
  category: "minor" | "major";
  masteryLevel: number;
  acquiredLevel: number;
  status: "reference" | "gm-adjudicated" | "incomplete-source";
};

export type PsionicCombatDeclaration = {
  targetIds: string[];
  attackMode: PsionicAttackMode | null;
  range: "short" | "medium" | "long";
  exchanges: number;
  defenseOverrides: Record<string, PsionicDefenseMode | null>;
  useArea: boolean;
};

export type PsionicExchangeLog = {
  id: string;
  round: number;
  segment: number;
  attackerId: string;
  defenderId: string;
  attackMode: PsionicAttackMode;
  defenseMode: PsionicDefenseMode | "Defenseless" | null;
  range: "short" | "medium" | "long";
  attackCost: number;
  defenseCost: number;
  loss: number | null;
  result: string | null;
  rolls: number[];
};

export type GrappleHold = {
  id: string;
  attackerId: string;
  defenderId: string;
  result: number;
  label: string;
  inferiorLabel?: string;
  realDamage: number;
  temporaryDamage: number;
  establishedRound: number;
  establishedOrder: number;
  footGrab?: boolean;
};

export type PendingUnarmedResolution = {
  id: string;
  eventKey: string;
  attackerId: string;
  defenderId: string;
  action: "grapple" | "overbear";
  phase: "fending" | "unarmed-hit" | "follow-up" | "complete" | "cancelled";
  eligibleFenderIds: string[];
  attemptedFenderIds: string[];
  cancelledById: string | null;
  hitRoll: number | null;
  hitTarget: number | null;
  hitModifier: number;
  hit: boolean | null;
  resultRoll: number | null;
  resultModifier: number;
  adjustedResult: number | null;
  outcomeLabel: string;
  realDamage: number;
  temporaryDamage: number;
  followUpGrappleBonus: number;
  repeatCappedAtEight: boolean;
};

export type SegmentedParticipant = {
  id: string;
  kind: "character" | "enemy" | "npc";
  characterId?: string;
  stableNpcId?: string;
  markerNumber: number | null;
  name: string;
  hitDice: string;
  attackBonus: number | null;
  armorClass: number | null;
  currentHp: number;
  maxHp: number;
  temporaryDamage?: number;
  nonIntelligent: boolean;
  armoredHead: boolean;
  joinedRound: number;
  side: "party" | "opposition";
  action: SegmentedAction;
  actionDetail: string;
  castingTime: number;
  holdSegment: number;
  specializedRof: number;
  segmentModifier: number;
  initiativeRoll: number | null;
  subInitiativeRoll: number | null;
  scheduledSegment: number | null;
  declarationRound: number | null;
  completedEvents: string[];
  statusNote: string;
  ready: boolean;
  targetId: string | null;
  targetIds: string[];
  areaOfEffect: boolean;
  preparedSpellSlotId: string | null;
  damageExpression: string;
  onslaughtAttacks: MonsterOnslaughtAttack[];
  equippedWeaponId: string | null;
  pendingWeaponId: string | null;
  pendingOffhandWeaponId?: string | null;
  resolutions: Record<string, CombatEventResolution>;
  armorMode?: "natural" | "worn";
  armorProfile?: "flesh" | "hide" | "scales" | "plates" | "padded" | "padded-shield" | "leather" | "leather-shield" | "ring" | "ring-shield" | "studded" | "studded-shield" | "scale" | "scale-shield" | "chain" | "chain-shield" | "banded" | "banded-shield" | "splint" | "splint-shield" | "plate" | "plate-shield" | "full-plate" | "full-plate-shield";
  attackMode?: "natural" | "weapon";
  naturalSpeed?: "fast" | "normal" | "slow";
  weaponRulesId?: string | null;
  weaponRulesIds?: string[];
  manualHitModifier?: string;
  manualDamageModifier?: string;
  movementRate?: number;
  size?: "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";
  large?: boolean;
  unarmedOverrides?: UnarmedOverrides;
  psionics?: PsionicsSetup;
  psionicCombat?: PsionicCombatDeclaration | null;
};

export type MeleeEngagement = {
  attackerId: string;
  defenderId: string;
  createdRound: number;
};

export type CombatEffect = {
  id: string;
  name: string;
  target: string;
  participantId?: string;
  description: string;
  remainingRounds: number;
};

export type SegmentedInitiativeState = {
  enabled: boolean;
  rollMode: "group" | "individual";
  round: number;
  currentSegment: number;
  phase: "declaration" | "active" | "round-complete";
  partyRoll: number | null;
  oppositionRoll: number | null;
  partySurprised: boolean;
  oppositionSurprised: boolean;
  partySurpriseRoll: number | null;
  oppositionSurpriseRoll: number | null;
  partySurpriseSegments: number;
  oppositionSurpriseSegments: number;
  partySurpriseThreshold: number;
  oppositionSurpriseThreshold: number;
  declarationStartedAt: number | null;
  participants: SegmentedParticipant[];
  engagements: MeleeEngagement[];
  grappleHolds: GrappleHold[];
  pendingUnarmed: PendingUnarmedResolution | null;
  psionicExchanges?: PsionicExchangeLog[];
  effects: CombatEffect[];
  houseRuleHitDieDamage: boolean;
  magicalArmorWrestling: boolean;
  showAllDeclarations: boolean;
  combatTallies: Record<string, { damageDealt: number; damageReceived: number; attacks: number; attacksMissedAgainst: number; savesSucceeded: number; savesFailed: number; moves: number; currentHitStreak: number; longestHitStreak: number }>;
  lastCheers: Array<{ title: string; participantId?: string; text: string }>;
};

export type DashboardState = {
  marchColumns: 1 | 2 | 5;
  marchingOrderIds: string[];
  marchingOrderSlots: Array<string | null>;
  scoutingCharacterId: string | null;
  lightCarrierIds: string[];
  crawlCount: number;
  elapsedMinutes: number;
  crawlStartTime: string;
  crawlStepMinutes: 10 | 240;
  encounterDieSize: number;
  encounterEvery: number;
  encounterTableDieSize: number;
  partySurpriseChance: number;
  foesSurpriseChance: number;
  turnsSinceRest: number;
  watchesSinceRest: number;
  encounterRestRequired: boolean;
  encounterActive: boolean;
  encounterHistory: EncounterCheck[];
  lights: LightSource[];
};

export type TravelTerrain =
  | "road"
  | "farmland"
  | "clear"
  | "scrub"
  | "light-woods"
  | "forest"
  | "hills"
  | "mountains"
  | "swamp"
  | "jungle"
  | "desert"
  | "barren";

export type TravelEncounterArea = "settled" | "patrolled" | "wilderness";

export type TravelPlannerState = {
  distanceHexes: number;
  speedHexesPerDay: number;
  startDate: string;
  startTime: string;
  routeTerrains: TravelTerrain[];
  returnTrip: boolean;
  navigationSkill: number;
  humanoids: number;
  smallAnimals: number;
  packBeasts: number;
  camels: number;
  massiveCreatures: number;
  forage: boolean;
  graze: boolean;
  naturalWater: boolean;
  noReserve: boolean;
  encounterArea: TravelEncounterArea;
  encounterRolls: Record<string, number>;
  encounterSignature: string;
};

export function defaultTravelPlanner(): TravelPlannerState {
  return {
    distanceHexes: 0,
    speedHexesPerDay: 0,
    startDate: today(),
    startTime: "08:00",
    routeTerrains: [],
    returnTrip: false,
    navigationSkill: 0,
    humanoids: 0,
    smallAnimals: 0,
    packBeasts: 0,
    camels: 0,
    massiveCreatures: 0,
    forage: true,
    graze: true,
    naturalWater: true,
    noReserve: false,
    encounterArea: "wilderness",
    encounterRolls: {},
    encounterSignature: "",
  };
}

export type CampaignState = {
  statOrderVersion: 2;
  characterCampaigns: Array<{ id: string; name: string }>;
  activeCharacterCampaignId: string;
  sessionNumber: number;
  sessionDate: string;
  partyFund: number;
  partyFundsByCampaign: Record<string, number>;
  sessionSalesPool: number;
  characters: Character[];
  characterFolders: CharacterFolder[];
  inventory: InventoryItem[];
  sharedInventoryByCampaign: Record<string, InventoryItem[]>;
  discardedItems: DiscardedItem[];
  discardedCharacters: DiscardedCharacter[];
  stableNpcs: StableNpc[];
  discardedStableNpcs: DiscardedStableNpc[];
  catalog: CatalogItem[];
  inventoryManagement: InventoryManagementState;
  missionCharacterIds: string[];
  expeditionNpcIds: string[];
  initiativeResults: InitiativeResult[];
  diceLog: DiceResult[];
  xpTracker: XpTrackerState;
  segmentedInitiative: SegmentedInitiativeState;
  dashboard: DashboardState;
  travelByCampaign: Record<string, TravelPlannerState>;
};

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export const emptyCampaign: CampaignState = {
  statOrderVersion: 2,
  characterCampaigns: [{ id: "default", name: "Campaign 1" }],
  activeCharacterCampaignId: "default",
  sessionNumber: 1,
  sessionDate: today(),
  partyFund: 0,
  partyFundsByCampaign: { default: 0 },
  sessionSalesPool: 0,
  characters: [],
  characterFolders: [],
  inventory: [],
  sharedInventoryByCampaign: { default: [] },
  discardedItems: [],
  discardedCharacters: [],
  stableNpcs: [],
  discardedStableNpcs: [],
  catalog: [],
  inventoryManagement: { owners: [], locations: [], containers: [], stacks: [], layoutPositions: {}, activityLog: [], sellVisible: true, shoppingCart: [], discarded: [] },
  missionCharacterIds: [],
  expeditionNpcIds: [],
  initiativeResults: [],
  diceLog: [],
  xpTracker: {
    enemies: [],
    treasureGp: 0,
    treasureXpAwardedItemValues: {},
    roomsExplored: 0,
    otherXp: 0,
    shareWeights: {},
    primeXpBonuses: {},
    recentEnemies: [],
  },
  segmentedInitiative: {
    enabled: false,
    rollMode: "group",
    round: 1,
    currentSegment: 0,
    phase: "declaration",
    partyRoll: null,
    oppositionRoll: null,
    partySurprised: false,
    oppositionSurprised: false,
    partySurpriseRoll: null,
    oppositionSurpriseRoll: null,
    partySurpriseSegments: 0,
    oppositionSurpriseSegments: 0,
    partySurpriseThreshold: 2,
    oppositionSurpriseThreshold: 2,
    declarationStartedAt: null,
    participants: [],
    engagements: [],
    grappleHolds: [],
    pendingUnarmed: null,
    effects: [],
    houseRuleHitDieDamage: false,
    magicalArmorWrestling: false,
    showAllDeclarations: false,
    combatTallies: {},
    lastCheers: [],
  },
  dashboard: {
    marchColumns: 1,
    marchingOrderIds: [],
    marchingOrderSlots: Array.from({ length: 25 }, () => null),
    scoutingCharacterId: null,
    lightCarrierIds: [],
    crawlCount: 0,
    elapsedMinutes: 0,
    crawlStartTime: "",
    crawlStepMinutes: 10,
    encounterDieSize: 6,
    encounterEvery: 3,
    encounterTableDieSize: 20,
    partySurpriseChance: 1,
    foesSurpriseChance: 1,
    turnsSinceRest: 0,
    watchesSinceRest: 0,
    encounterRestRequired: false,
    encounterActive: false,
    encounterHistory: [],
    lights: [
      { id: "torch", type: "torch", remainingMinutes: 0, maximumMinutes: 60 },
      { id: "lantern", type: "lantern", remainingMinutes: 0, maximumMinutes: 240 },
    ],
  },
  travelByCampaign: { default: defaultTravelPlanner() },
};
