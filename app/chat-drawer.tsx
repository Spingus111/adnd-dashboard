"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CHAT_ACTION_EVENT, type ChatActionDetail } from "./chat-events";
import { evaluateDiceExpression, evaluateInlineDice, looksLikeDice, type DiceEvaluation } from "./dice-expression";
import { abilityNames, abilitySummary, derivedAbilityItems, effectiveStrengthScore, strengthScoreLabel } from "./osric-stats";
import type { CampaignState, Character } from "./types";
import { resolvedAttackD20, singleHitDieExpression } from "./osric-combat";
import { availableCharacterWeapons, characterWeapon, unarmedWeapon, weaponDamageBonus, weaponEquipmentBonus } from "./character-weapons";
import CharacterNameLink from "./character-navigation";
import { chatIsNearBottom, chatMessagesEqual } from "./chat-scroll";
import { combatConditionRule } from "./combat-conditions";
import { handStateForWeapon, usesUnarmedDamage } from "./hand-states";
import { formatGpAsPrice } from "./currency";
import { PARTY_CHAT_PREFERENCES_KEY, partyChatRoleForOneTimeGmReset, partyChatRoleFromPreferences, partyChatRoleHasGmPermissions, type PartyChatRole } from "./party-chat-role";
import { nameCommand } from "./character-names";
import { getNonProficiencyPenalty, getWeaponTrainingState } from "./osric-advancement";
import { characterCoinGp } from "./inventory-management";
import { attackControlForCharacter, requestSharedAttack, subscribeAttackControls } from "./combat-attack-control";
import { rollSecureDie } from "./random";
import { characterTileStyle } from "./tile-color";

type Props = { campaign: CampaignState; setCampaign: React.Dispatch<React.SetStateAction<CampaignState>>; combatTabActive: boolean };
type Visibility = "public" | "private" | "whisper";

type ChatMessage = {
  id: string;
  authorName: string;
  authorClientId?: string | null;
  authorIsGm?: boolean | null;
  emoji: string;
  color: string;
  content: string;
  rollDetail: string | null;
  visibility?: Visibility | null;
  recipientClientId?: string | null;
  recipientName?: string | null;
  tone?: "hostile" | "psionic" | "psionic-hostile" | null;
  createdAt: string;
};

type RaisedHand = { clientId: string; playerName: string; emoji: string; color: string; createdAt?: string };

const diceSizes = [4, 6, 8, 10, 12, 20, 100] as const;
const saveLabels = [
  ["death", "DTH", "☠️"], ["wands", "AIM", "⚡"], ["polymorph", "PLY", "🗿"], ["breath", "BRT", "🐲"], ["spells", "SPE", "✨"],
] as const;
const abilityIcons = ["💪", "🎯", "❤️", "🧠", "🦉", "🎭"] as const;

function rollDie(size: number) { return rollSecureDie(size); }
function signed(value: number) { return value >= 0 ? `+${value}` : String(value); }
function numericModifier(value: string | number | undefined) { const parsed = Number(String(value ?? "0").replaceAll("−", "-").replace(/[^0-9+.-]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function browserId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const merged = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => merged.set(message.id, message));
  return Array.from(merged.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-200);
}

function playerLabel(message: ChatMessage) {
  return message.authorName.replace(/\s*\(GM\)$/, "").split(" · ")[0].trim() || message.authorName;
}

function markedNaturalRoll(roll: number) {
  return roll === 20 ? "[[max:20]]" : roll === 1 ? "[[min:1]]" : String(roll);
}

function renderRollMarkup(line: string) {
  return line.split(/(\[\[(?:max|min):\d+\]\])/g).map((part, index) => {
    const match = part.match(/^\[\[(max|min):(\d+)\]\]$/);
    return match ? <span className={`natural-die ${match[1]}` } key={index}>{match[2]}</span> : part;
  });
}

export default function ChatDrawer({ campaign, setCampaign, combatTabActive }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [dockedIds, setDockedIds] = useState<string[]>([]);
  const [collapsedDockedIds, setCollapsedDockedIds] = useState<string[]>([]);
  const [role, setRole] = useState<PartyChatRole | null>(null);
  const [choosingPartyCharacters, setChoosingPartyCharacters] = useState(false);
  const [gmColor, setGmColor] = useState("#5b3f75");
  const [playerName, setPlayerName] = useState("");
  const [clientId, setClientId] = useState("");
  const [lastRoleResetId, setLastRoleResetId] = useState("");
  const [claimingPrimaryGm, setClaimingPrimaryGm] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [diceCount, setDiceCount] = useState(1);
  const [diceModifier, setDiceModifier] = useState(0);
  const [hiddenRoll, setHiddenRoll] = useState(false);
  const [whisperTarget, setWhisperTarget] = useState("");
  const [status, setStatus] = useState("");
  const [rolling, setRolling] = useState(false);
  const [freshMessageId, setFreshMessageId] = useState("");
  const [incomingMessagePulse, setIncomingMessagePulse] = useState(false);
  const [, setAttackControlRevision] = useState(0);
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const stickToLatest = useRef(true);
  const readerScrollTop = useRef(0);
  const animationTimer = useRef<number | null>(null);
  const incomingMessageTimer = useRef<number | null>(null);
  const chatHasLoaded = useRef(false);
  const seenMessageIds = useRef(new Set<string>());
  const drawerSwipe = useRef<{ x: number; y: number } | null>(null);
  const edgeSwipe = useRef<{ x: number; y: number } | null>(null);
  const appliedRoleResetId = useRef("");

  const activeCharacters = useMemo(() => campaign.characters.filter((character) => character.campaignId === campaign.activeCharacterCampaignId), [campaign.activeCharacterCampaignId, campaign.characters]);
  const dockedCharacters = useMemo(() => dockedIds.map((characterId) => activeCharacters.find((character) => character.id === characterId)).filter((character): character is Character => Boolean(character)), [activeCharacters, dockedIds]);
  const primaryCharacter = dockedCharacters[0];
  const cleanPlayerName = playerName.trim();
  const gmRole = role === "gm";
  const soloRole = role === "solo";
  const hasGmPermissions = partyChatRoleHasGmPermissions(role);
  const identityName = gmRole ? `${cleanPlayerName || "GM"} (GM)` : soloRole ? `${cleanPlayerName || "Solo"} (Solo)` : cleanPlayerName || "Player";
  const identity = {
    name: identityName,
    emoji: primaryCharacter?.emoji || (hasGmPermissions ? "🎲" : "💬"),
    color: hasGmPermissions && !primaryCharacter ? gmColor : primaryCharacter?.tileColor || "#667085",
  };
  const whisperPlayers = useMemo(() => {
    const players = new Map<string, string>();
    messages.forEach((message) => {
      if (message.authorClientId && message.authorClientId !== clientId && !message.authorIsGm) players.set(message.authorClientId, playerLabel(message));
    });
    return Array.from(players, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [clientId, messages]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(PARTY_CHAT_PREFERENCES_KEY);
        const parsed = stored ? JSON.parse(stored) as { playerName?: string; dockedIds?: string[]; collapsedDockedIds?: string[]; role?: PartyChatRole; gmRole?: boolean; gmColor?: string; clientId?: string; lastRoleResetId?: string } : {};
        setPlayerName(typeof parsed.playerName === "string" ? parsed.playerName : "");
        setDockedIds(Array.isArray(parsed.dockedIds) ? parsed.dockedIds.filter((entry) => typeof entry === "string") : []);
        setCollapsedDockedIds(Array.isArray(parsed.collapsedDockedIds) ? parsed.collapsedDockedIds.filter((entry) => typeof entry === "string") : []);
        setRole(partyChatRoleFromPreferences(parsed));
        setGmColor(typeof parsed.gmColor === "string" && /^#[0-9a-f]{6}$/i.test(parsed.gmColor) ? parsed.gmColor : "#5b3f75");
        setClientId(typeof parsed.clientId === "string" && parsed.clientId ? parsed.clientId : browserId());
        const storedRoleResetId = typeof parsed.lastRoleResetId === "string" ? parsed.lastRoleResetId : "";
        appliedRoleResetId.current = storedRoleResetId;
        setLastRoleResetId(storedRoleResetId);
      } catch {
        setClientId(browserId());
      }
      setPreferencesReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!preferencesReady || !clientId) return;
    try {
      window.localStorage.setItem(PARTY_CHAT_PREFERENCES_KEY, JSON.stringify({ playerName, dockedIds, collapsedDockedIds, role, gmRole: role ? hasGmPermissions : undefined, gmColor, clientId, lastRoleResetId }));
      window.dispatchEvent(new CustomEvent("adnd-role-change", { detail: { role, gmRole: hasGmPermissions, dockedIds, clientId } }));
    } catch {}
  }, [clientId, collapsedDockedIds, dockedIds, gmColor, hasGmPermissions, lastRoleResetId, playerName, preferencesReady, role]);

  useEffect(() => {
    document.body.classList.toggle("chat-open", open);
    return () => document.body.classList.remove("chat-open");
  }, [open]);

  useEffect(() => {
    if (!preferencesReady || !clientId) return;
    let active = true;
    chatHasLoaded.current = false;
    seenMessageIds.current = new Set();
    async function loadMessages() {
      try {
        const params = new URLSearchParams({ viewer: clientId, gm: hasGmPermissions ? "1" : "0" });
        const response = await fetch(`/api/chat?${params}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load chat.");
        if (active) {
          const incomingMessages = result.messages ?? [];
          if (chatHasLoaded.current && incomingMessages.some((message: ChatMessage) => !seenMessageIds.current.has(message.id))) pulseIncomingMessage();
          setMessages((current) => chatMessagesEqual(current, incomingMessages) ? current : incomingMessages);
          setRaisedHands(result.hands ?? []);
          const roleResetId = typeof result.roleReset?.id === "string" ? result.roleReset.id : "";
          const resetGmClientId = typeof result.roleReset?.gmClientId === "string" ? result.roleReset.gmClientId : "";
          if (roleResetId && roleResetId !== appliedRoleResetId.current) {
            appliedRoleResetId.current = roleResetId;
            setLastRoleResetId(roleResetId);
            setRole(partyChatRoleForOneTimeGmReset(clientId, resetGmClientId));
          }
          seenMessageIds.current = new Set(incomingMessages.map((message: ChatMessage) => message.id));
          chatHasLoaded.current = true;
        }
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Could not load chat.");
      }
    }
    void loadMessages();
    const timer = window.setInterval(loadMessages, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [clientId, hasGmPermissions, preferencesReady]);

  useEffect(() => () => {
    if (incomingMessageTimer.current) window.clearTimeout(incomingMessageTimer.current);
  }, []);

  useEffect(() => subscribeAttackControls(() => setAttackControlRevision((value) => value + 1)), []);

  useEffect(() => {
    if (!open) return;
    const target = messagesRef.current;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      target.scrollTop = stickToLatest.current ? target.scrollHeight : readerScrollTop.current;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const target = messagesRef.current;
    if (!target) return;
    stickToLatest.current = true;
    const frame = window.requestAnimationFrame(() => {
      target.scrollTop = target.scrollHeight;
      readerScrollTop.current = target.scrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function trackChatScroll() {
    const target = messagesRef.current;
    if (!target) return;
    readerScrollTop.current = target.scrollTop;
    stickToLatest.current = chatIsNearBottom(target.scrollTop, target.clientHeight, target.scrollHeight);
  }

  function pulseRoll() {
    setRolling(false);
    window.requestAnimationFrame(() => setRolling(true));
    if (animationTimer.current) window.clearTimeout(animationTimer.current);
    animationTimer.current = window.setTimeout(() => setRolling(false), 190);
  }

  function pulseIncomingMessage() {
    setIncomingMessagePulse(false);
    window.requestAnimationFrame(() => {
      setIncomingMessagePulse(true);
      if (incomingMessageTimer.current) window.clearTimeout(incomingMessageTimer.current);
      incomingMessageTimer.current = window.setTimeout(() => setIncomingMessagePulse(false), 520);
    });
  }

  async function postMessage(content: string, rollDetail: string | null = null, options?: { visibility?: Visibility; recipientClientId?: string; recipientName?: string; tone?: "hostile" | "psionic" | "psionic-hostile"; actor?: Character; emoji?: string; color?: string }) {
    const cleaned = content.trim();
    if (!cleaned || !clientId) return;
    const actorPresentation = { emoji: options?.actor?.emoji ?? identity.emoji, color: options?.actor?.tileColor ?? identity.color };
    // Successful sends should not insert a temporary status row below the chat.
    // That row changed the scrollable pane height and made the bottom jump.
    setStatus("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authorName: identity.name, authorClientId: clientId, authorIsGm: hasGmPermissions, emoji: options?.emoji ?? actorPresentation.emoji, color: options?.color ?? actorPresentation.color,
          content: cleaned, rollDetail, visibility: options?.visibility ?? "public", recipientClientId: options?.recipientClientId ?? null, recipientName: options?.recipientName ?? null, tone: options?.tone ?? null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send chat message.");
      setMessages((current) => mergeMessages(current, [result.message]));
      setFreshMessageId(result.message.id);
      window.setTimeout(() => setFreshMessageId(""), 260);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send chat message.");
    }
  }

  function rollDice(count: number, size: number, modifier: number, label?: string) {
    pulseRoll();
    const expression = `${count}d${size}${modifier ? signed(modifier) : ""}`;
    postDiceEvaluations(evaluateDiceExpression(expression), label);
  }

  function postDiceEvaluations(results: DiceEvaluation[], heading?: string, actor?: Character) {
    const lines = results.flatMap((result, index) => [
      index === 0 && heading ? `🎲 ${heading}` : result.label ? `🎲 ${result.label}` : results.length > 1 ? `🎲 Roll ${index + 1}` : `🎲 ${result.source}`,
      ...result.lines.map((line) => {
        return line;
      }),
    ]);
    const detail = results.map((result) => `${result.source} = ${result.total}`).join("; ");
    void postMessage(lines.join("\n"), detail, { visibility: hiddenRoll ? "private" : "public", actor });
  }

  function rollUnder(character: Character, statIndex: number) {
    pulseRoll();
    const target = statIndex === 0 ? effectiveStrengthScore(character.stats[0], character.exceptionalStrength) : Number(character.stats[statIndex]);
    const roll = rollDie(20);
    const success = roll <= target;
    const detail = `d20 ${roll} ≤ ${target}`;
    void postMessage(`${character.name} · ${abilityNames[statIndex]} roll-under\n${success ? "✅ SUCCESS" : "❌ FAILURE"} — ${detail}`, detail, { visibility: hiddenRoll ? "private" : "public", actor: character });
  }

  function rollFullAbility(character: Character, statIndex: number) {
    pulseRoll();
    const score = statIndex === 0 ? effectiveStrengthScore(character.stats[0], character.exceptionalStrength) : Number(character.stats[statIndex]);
    const scoreLabel = statIndex === 0 ? strengthScoreLabel(character.stats[0], character.exceptionalStrength) : String(score);
    const primaryRoll = rollDie(20);
    const parts = [`${primaryRoll <= score ? "✅ SUCCESS" : "❌ FAILURE"} — Ability check: d20 ${primaryRoll} ≤ ${score}`];
    derivedAbilityItems(statIndex, character.stats[statIndex], statIndex === 0 ? character.exceptionalStrength : null).forEach((item) => {
      if (!item.roll) return;
      const roll = rollDie(item.roll.size);
      const status = item.roll.extraordinaryTarget && roll <= item.roll.extraordinaryTarget ? "🌟 EXTRAORDINARY SUCCESS" : roll <= item.roll.target ? "✅ SUCCESS" : "❌ FAILURE";
      parts.push(`${status} — ${item.label}: d${item.roll.size} ${roll} ≤ ${item.roll.target}`);
    });
    const detail = parts.join("; ");
    void postMessage(`${character.name} · ${abilityNames[statIndex]} ${scoreLabel}\n${parts.join("\n")}\nDerived values — ${abilitySummary(statIndex, character.stats[statIndex], statIndex === 0 ? character.exceptionalStrength : null)}`, detail, { visibility: hiddenRoll ? "private" : "public", actor: character });
  }

  function rollDerived(character: Character, statIndex: number, key: string) {
    const item = derivedAbilityItems(statIndex, character.stats[statIndex], statIndex === 0 ? character.exceptionalStrength : null).find((entry) => entry.key === key);
    if (!item) return;
    if (!item.roll) return void postMessage(`${character.name} · ${abilityNames[statIndex]} · ${item.label}: ${item.value}`, null, { actor: character });
    pulseRoll();
    const roll = rollDie(item.roll.size);
    const extraordinary = Boolean(item.roll.extraordinaryTarget && roll <= item.roll.extraordinaryTarget);
    const success = roll <= item.roll.target;
    const detail = `d${item.roll.size} ${roll} ≤ ${item.roll.target}`;
    void postMessage(`${character.name} · ${item.label}\n${extraordinary ? "🌟 EXTRAORDINARY SUCCESS" : success ? "✅ SUCCESS" : "❌ FAILURE"} — ${detail}`, detail, { visibility: hiddenRoll ? "private" : "public", actor: character });
  }

  function handWeaponId(character: Character) {
    const owner = campaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
    const quick = owner && campaign.inventoryManagement.containers.find((entry) => entry.containerType === "quick-access" && entry.holderType === "owner" && entry.holderId === owner.id);
    const held = quick && campaign.inventoryManagement.stacks.find((entry) => entry.containerId === quick.id && (entry.handSlot === "main" || entry.handSlot === "offhand") && entry.equipment?.kind === "weapon");
    return held ? `inventory:${held.id}` : null;
  }

  function rollEquippedAttack(character: Character) {
    const combatant = campaign.segmentedInitiative.participants.find((participant) => participant.characterId === character.id);
    const selectedWeapon = characterWeapon(character, handWeaponId(character) ?? combatant?.equippedWeaponId ?? character.equippedWeaponId) ?? unarmedWeapon;
    const weapon = usesUnarmedDamage(character, selectedWeapon.id) ? unarmedWeapon : selectedWeapon;
    const conditionRule = combatConditionRule(campaign.segmentedInitiative.effects.filter((effect) => effect.participantId === combatant?.id
      || (!effect.participantId && effect.target === character.name)));
    const ranged = combatant?.action === "missile" || combatant?.action === "spec-ranged" || combatant?.action === "close-hurl" || weapon.category === "ranged";
    const statIndex = ranged ? 1 : 0;
    const statItems = derivedAbilityItems(statIndex, character.stats[statIndex], statIndex === 0 ? character.exceptionalStrength : null);
    const statHit = numericModifier(statItems.find((item) => item.key === (ranged ? "missile-hit" : "melee-hit"))?.value);
    const strengthDamageApplies = weapon.category === "melee" || combatant?.action === "close-hurl";
    const statDamage = strengthDamageApplies ? numericModifier(derivedAbilityItems(0, character.stats[0], character.exceptionalStrength).find((item) => item.key === "damage")?.value) : 0;
    const training = getWeaponTrainingState(character, weapon);
    const specialized = training.specialized;
    const proficiencyAdjustment = weapon.id !== "unarmed" && !training.proficient ? getNonProficiencyPenalty(character) : 0;
    const actionHitBonus = (combatant?.action === "charge" ? 2 : 0) + (specialized ? 1 : 0) + proficiencyAdjustment;
    const attackModifier = character.toHit + weapon.attackBonus + statHit + actionHitBonus + conditionRule.attack;
    const houseDamage = campaign.segmentedInitiative.houseRuleHitDieDamage;
    const retainedWeaponDamage = houseDamage ? weaponDamageBonus(weapon.damage) : 0;
    const equipmentBonus = weaponEquipmentBonus(weapon);
    const damageModifier = statDamage + (specialized ? 2 : 0) + equipmentBonus + retainedWeaponDamage + conditionRule.damage;
    const attackRoll = rollDie(20);
    const attackTotal = resolvedAttackD20(attackRoll) + attackModifier;
    const baseDamage = weapon.id === "unarmed" ? "1d2" : houseDamage ? singleHitDieExpression(character.hitDice) : weapon.damage.trim();
    let damageLine = "Damage — no damage dice configured";
    let damageDetail = "";
    if (looksLikeDice(baseDamage)) {
      const expression = `${baseDamage}${damageModifier ? signed(damageModifier) : ""}`;
      const damage = evaluateDiceExpression(expression)[0];
      damageLine = `Damage — ${damage.lines.join(" · ")}\nTOTAL — ${damage.total} damage to AC≤${attackTotal}`;
      damageDetail = `; ${damage.source} = ${damage.total}`;
    }
    const breakdown = [character.toHit ? `class ${signed(character.toHit)}` : "", `${ranged ? "DEX" : "STR"} ${signed(statHit)}`, equipmentBonus ? `weapon ${signed(equipmentBonus)} hit / damage` : "", proficiencyAdjustment ? `non-proficiency ${signed(proficiencyAdjustment)}` : "", attackRoll === 20 ? "natural 20 +5" : attackRoll === 1 ? "natural 1 always fails" : "", combatant?.action === "charge" ? "charge +2" : "", specialized ? "specialization +1 hit / +2 damage" : "", statDamage ? `STR damage ${signed(statDamage)}` : "", houseDamage && retainedWeaponDamage ? `weapon damage ${signed(retainedWeaponDamage)}` : "", conditionRule.attack ? `conditions ${signed(conditionRule.attack)} hit` : "", conditionRule.damage ? `conditions ${signed(conditionRule.damage)} damage` : ""].filter(Boolean).join(" · ");
    const detail = `d20 ${attackRoll}${attackRoll === 20 ? " +5" : ""} ${signed(attackModifier)} = ${attackTotal}${damageDetail}`;
    pulseRoll();
    void postMessage(`${character.name} · ${weapon.name}\nAttack — d20 [${markedNaturalRoll(attackRoll)}]${attackRoll === 20 ? " +5" : ""} ${signed(attackModifier)} = ${attackTotal}${attackRoll === 1 ? " · automatic failure" : ""}\n${breakdown}\n${damageLine}`, detail, { visibility: hiddenRoll ? "private" : "public", actor: character });
  }

  function rollSave(character: Character, save: keyof Character["saves"], label: string) {
    pulseRoll();
    const roll = rollDie(20);
    const target = character.saves[save];
    const combatant = campaign.segmentedInitiative.participants.find((participant) => participant.characterId === character.id);
    const modifier = combatConditionRule(campaign.segmentedInitiative.effects.filter((effect) => effect.participantId === combatant?.id
      || (!effect.participantId && effect.target === character.name))).saves;
    const total = roll + modifier;
    const success = total >= target;
    const detail = `d20 ${roll}${modifier ? ` ${signed(modifier)} = ${total}` : ""} ≥ ${target}`;
    void postMessage(`${character.name} · ${label} save\n${success ? "✅ SUCCESS" : "❌ FAILURE"} — ${detail}`, detail, { visibility: hiddenRoll ? "private" : "public", actor: character });
  }

  function rollReaction(character: Character) {
    const modifier = Number(String(derivedAbilityItems(5, character.stats[5]).find((item) => item.key === "reaction")?.value ?? "0").replace(/[^0-9+-]/g, "")) || 0;
    const roll = rollDie(100);
    const total = Math.max(1, Math.min(100, roll + modifier));
    const status = total <= 5 ? "Very hostile" : total <= 25 ? "Hostile" : total <= 45 ? "Unfavorable" : total <= 55 ? "Neutral" : total <= 75 ? "Favorable" : total <= 95 ? "Friendly" : "Very friendly";
    const detail = `d100 ${roll}${modifier ? ` ${signed(modifier)}` : ""} = ${total}`;
    pulseRoll();
    return postMessage(`${character.name} · reaction check\n${status} — ${detail} · CHA modifier ${signed(modifier)}`, detail, { visibility: hiddenRoll ? "private" : "public", actor: character });
  }

  function rollMacro(character: Character, macroIndex: number) {
    const macro = character.diceMacros[macroIndex];
    try {
      if (!looksLikeDice(macro.expression)) throw new Error("No dice were found.");
      pulseRoll();
      postDiceEvaluations(evaluateDiceExpression(macro.expression), `${character.name} · ${macro.name || `Macro ${macroIndex + 1}`}`, character);
    } catch {
      setStatus(`${character.name}'s ${macro.name || `Macro ${macroIndex + 1}`} needs a valid expression such as 2d6+3 or 4d6kh3.`);
    }
  }

  function handleChatAction(detail: ChatActionDetail) {
    if (detail.kind !== "combat-result" && detail.kind !== "external-roll") setOpen(true);
    if (detail.kind === "combat-result") return void postMessage(detail.content, detail.rollDetail ?? null, { visibility: hiddenRoll ? "private" : "public", tone: detail.tone, emoji: detail.emoji, color: detail.color });
    if (detail.kind === "external-roll") {
      pulseRoll();
      const roll = rollDie(20);
      if (detail.roll === "save") {
        const target = detail.target ?? 20;
        const success = roll >= target;
        const rollDetail = `d20 ${roll} ≥ ${target}`;
        return void postMessage(`${detail.label}\n${success ? "✅ SUCCESS" : "❌ FAILURE"} — ${rollDetail}`, rollDetail, { visibility: hiddenRoll ? "private" : "public", tone: detail.tone });
      }
      const modifier = detail.modifier ?? 0;
      const total = roll + modifier;
      const expression = `d20 ${roll} ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)} = ${total}`;
      return void postMessage(`${detail.label}\n🎲 ${expression}`, expression, { visibility: hiddenRoll ? "private" : "public", tone: detail.tone });
    }
    if (detail.kind === "item") {
      const value = detail.valueGp == null ? "" : ` · ${formatGpAsPrice(detail.valueGp, "Free")} each`;
      return void postMessage(`Item · ${detail.quantity ?? 1} × ${detail.label}${value}`);
    }
    const character = campaign.characters.find((entry) => entry.id === detail.characterId);
    if (!character) return;
    if (detail.kind === "ability") {
      if (detail.mode === "value") return void postMessage(`${character.name} · ${abilityNames[detail.statIndex]}: ${character.stats[detail.statIndex]}`, null, { actor: character });
      if (detail.statIndex === 5 && detail.mode === "full") {
        rollFullAbility(character, detail.statIndex);
        return void rollReaction(character);
      }
      return detail.mode === "under" ? rollUnder(character, detail.statIndex) : rollFullAbility(character, detail.statIndex);
    }
    if (detail.kind === "derived") return rollDerived(character, detail.statIndex, detail.key);
    if (detail.kind === "save") return detail.mode === "value" ? void postMessage(`${character.name} · ${detail.label} save target: ${character.saves[detail.save]}`, null, { actor: character }) : rollSave(character, detail.save, detail.label);
    if (detail.kind === "equipped-attack" || detail.roll === "attack") return rollEquippedAttack(character);
    void postMessage(`${character.name} · ${detail.label}: ${detail.value}`, null, { actor: character });
  }

  useEffect(() => {
    const listener = (event: Event) => {
      try {
        handleChatAction((event as CustomEvent<ChatActionDetail>).detail);
      } catch (error) {
        setOpen(true);
        setStatus(error instanceof Error ? error.message : "This chat action could not be completed.");
      }
    };
    window.addEventListener(CHAT_ACTION_EVENT, listener);
    return () => window.removeEventListener(CHAT_ACTION_EVENT, listener);
  });

  function submitDraft(event: React.FormEvent) {
    event.preventDefault();
    const generatedName = nameCommand(draft);
    if (generatedName) {
      void postMessage(`${generatedName.label} — ${generatedName.name}`);
    } else if (hasGmPermissions && (whisperTarget || /^\/w\s+/i.test(draft))) {
      const recipient = whisperPlayers.find((player) => player.id === whisperTarget);
      if (!recipient) return setStatus("Select a player before whispering.");
      void postMessage(draft.replace(/^\/w\s+/i, ""), null, { visibility: "whisper", recipientClientId: recipient.id, recipientName: recipient.name });
    } else {
      try {
        if (draft.includes("[") && draft.includes("]")) {
          const inline = evaluateInlineDice(draft);
          if (inline.results.length) {
            pulseRoll();
            const details = inline.results.map((result) => `${result.source} = ${result.total}`).join("; ");
            void postMessage(`${inline.rendered}\n${inline.results.map((result) => `${result.label ? `${result.label}: ` : ""}${result.lines.join(" · ")}`).join("\n")}`, details, { visibility: hiddenRoll ? "private" : "public" });
          } else void postMessage(draft, null, { visibility: hiddenRoll ? "private" : "public" });
        } else if (looksLikeDice(draft)) {
          pulseRoll();
          postDiceEvaluations(evaluateDiceExpression(draft));
        } else void postMessage(draft, null, { visibility: hiddenRoll ? "private" : "public" });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "That dice expression could not be rolled.");
        return;
      }
    }
    setDraft("");
  }

  async function clearChat() {
    if (!window.confirm("Clear every message and roll from party chat?")) return;
    try {
      const response = await fetch("/api/chat", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not clear chat.");
      setMessages([]); setRaisedHands([]); setStatus("Chat cleared.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not clear chat."); }
  }

  function toggleDock(characterId: string) {
    setDockedIds((current) => current.includes(characterId) ? current.filter((entry) => entry !== characterId) : [...current, characterId]);
  }

  async function setHand(raised: boolean, targetClientId = clientId) {
    if (!targetClientId) return;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: raised ? "raise-hand" : "lower-hand", authorClientId: targetClientId, requesterClientId: clientId, authorIsGm: hasGmPermissions, authorName: identity.name, emoji: identity.emoji, color: identity.color }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the raised hand.");
      setRaisedHands((current) => raised
        ? [...current.filter((hand) => hand.clientId !== targetClientId), { clientId: targetClientId, playerName: identity.name, emoji: identity.emoji, color: identity.color }]
        : current.filter((hand) => hand.clientId !== targetClientId));
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not update the raised hand."); }
  }

  async function claimPrimaryGm() {
    if (!clientId || claimingPrimaryGm) return;
    setClaimingPrimaryGm(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "claim-primary-gm", authorClientId: clientId, authorName: cleanPlayerName || "GM" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not set the primary GM.");
      const roleResetId = typeof result.roleReset?.id === "string" ? result.roleReset.id : "";
      if (roleResetId) {
        appliedRoleResetId.current = roleResetId;
        setLastRoleResetId(roleResetId);
      }
      setRole("gm");
      setStatus("You are GM. Other connected identities were reset to Party Member once; everyone can now change role freely.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not set the primary GM.");
    } finally {
      setClaimingPrimaryGm(false);
    }
  }

  function switchDockedWeapon(character: Character, weaponId: string | null) {
    const combatant = campaign.segmentedInitiative.participants.find((participant) => participant.characterId === character.id);
    if (combatTabActive && combatant && !weaponId) {
      setStatus("Choose the weapon being readied for the switch action.");
      return;
    }
    if (combatTabActive && combatant && campaign.segmentedInitiative.phase !== "declaration") {
      setStatus("Weapon changes must be declared and resolved as a combat action.");
      return;
    }
    setCampaign((current) => ({
      ...current,
      characters: current.characters.map((entry) => (!combatTabActive || !combatant) && entry.id === character.id ? { ...entry, equippedWeaponId: weaponId, handState: handStateForWeapon(entry, weaponId ?? "unarmed") } : entry),
      segmentedInitiative: combatTabActive && combatant ? {
        ...current.segmentedInitiative,
        participants: current.segmentedInitiative.participants.map((participant) => participant.id === combatant.id ? { ...participant, action: "switch-weapon", pendingWeaponId: weaponId, targetId: null, targetIds: [], ready: Boolean(weaponId), statusNote: "Weapon switch declared" } : participant),
      } : {
        ...current.segmentedInitiative,
        participants: current.segmentedInitiative.participants.map((participant) => participant.characterId === character.id ? { ...participant, equippedWeaponId: weaponId, pendingWeaponId: null } : participant),
      },
    }));
    setStatus(combatTabActive && combatant ? "Weapon switch declared for this round." : "Equipped weapon updated.");
  }

  function finishDrawerSwipe(x: number, y: number) {
    const start = drawerSwipe.current;
    drawerSwipe.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (dx < -64 && Math.abs(dx) > Math.abs(dy) * 1.2) setOpen(false);
  }

  function moveDocked(characterId: string, direction: -1 | 1) {
    setDockedIds((current) => {
      const index = current.indexOf(characterId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function toggleDockedCollapsed(characterId: string) {
    setCollapsedDockedIds((current) => current.includes(characterId) ? current.filter((entry) => entry !== characterId) : [...current, characterId]);
  }

  function finishEdgeSwipe(x: number, y: number) {
    const start = edgeSwipe.current;
    edgeSwipe.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (dx > 64 && Math.abs(dx) > Math.abs(dy) * 1.2) setOpen(true);
  }

  return <>
    <button className={`chat-launcher ${open ? "open" : ""} ${incomingMessagePulse ? "has-incoming" : ""}`} onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls="party-chat-drawer">{open ? "Close chat" : "💬 Party chat"}</button>
    {!open && <div className="chat-swipe-edge" aria-hidden="true" onTouchStart={(event) => { const touch = event.touches[0]; edgeSwipe.current = { x: touch.clientX, y: touch.clientY }; }} onTouchEnd={(event) => { const touch = event.changedTouches[0]; finishEdgeSwipe(touch.clientX, touch.clientY); }} />}
    <aside id="party-chat-drawer" className={`chat-drawer ${open ? "open" : ""}`} aria-label="Party chat" aria-hidden={!open} onTouchStart={(event) => { const touch = event.touches[0]; drawerSwipe.current = { x: touch.clientX, y: touch.clientY }; }} onTouchEnd={(event) => { const touch = event.changedTouches[0]; finishDrawerSwipe(touch.clientX, touch.clientY); }}>
      <header className="chat-header">
        <h2>Party Chat</h2>
        <details className="chat-dock-controls">
          <summary>Identity <span>{identity.emoji} {identity.name}</span></summary>
          <div className="chat-dock-popover">
            <label className="chat-player-name">Your name<input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Player name" maxLength={40} /></label>
            <fieldset className="chat-role-picker"><legend>I am a…</legend><label><input type="radio" name="chat-role" checked={role === "party-member"} onChange={() => setRole("party-member")} />Party Member</label><label><input type="radio" name="chat-role" checked={role === "gm"} onChange={() => setRole("gm")} />GM</label><label><input type="radio" name="chat-role" checked={role === "solo"} onChange={() => setRole("solo")} />Solo</label></fieldset>
            <button className="primary-button chat-primary-gm-button" type="button" disabled={!clientId || claimingPrimaryGm} onClick={() => void claimPrimaryGm()}>{claimingPrimaryGm ? "Resetting roles…" : "Set me as primary GM"}</button>
            <p className="chat-primary-gm-note">One-time reset: this browser becomes GM and other connected identities become Party Members. Everyone may change role afterward.</p>
            {hasGmPermissions && <label className="gm-color-control">Identity color<input type="color" value={gmColor} onChange={(event) => setGmColor(event.target.value)} /></label>}
            <div className="chat-character-options">{activeCharacters.length === 0 ? <span>No characters available in this campaign.</span> : activeCharacters.map((character) => <label style={characterTileStyle(character.tileColor)} key={character.id}><input type="checkbox" checked={dockedIds.includes(character.id)} onChange={() => toggleDock(character.id)} /><span>{character.emoji}</span><b>{character.name}</b><small>Level {character.level}</small></label>)}</div>
            <p>{primaryCharacter ? `${primaryCharacter.name}, the first docked character, supplies this player's color and emoji.` : "Dock one or more characters for identity and quick rolls."}</p>
          </div>
        </details>
        <button className="action-link danger-link" onClick={clearChat}>Clear</button>
        <button onClick={() => setOpen(false)} aria-label="Close party chat">×</button>
      </header>
      <div className="chat-sheet-scroll">
        {dockedCharacters.length > 0 && <section className={`chat-quick-rolls ${dockedCharacters.length === 1 ? "single-docked" : "multiple-docked"}`}>{dockedCharacters.map((character, index) => {
          const collapsed = dockedCharacters.length > 1 && collapsedDockedIds.includes(character.id);
          const sharedAttack = combatTabActive ? attackControlForCharacter(character.id) : null;
          return <article className={`chat-quick-character ${collapsed ? "collapsed" : ""} ${index === 0 ? "player-character" : ""}`} style={characterTileStyle(character.tileColor)} key={character.id}>
            <div className="chat-quick-summary"><div className="chat-quick-title"><span className="chat-quick-emoji">{character.emoji}</span><CharacterNameLink characterId={character.id} onNavigate={() => setOpen(false)}>{character.name}</CharacterNameLink></div><div className="chat-quick-stats"><span>HP <b>{character.currentHp}/{character.maxHp}</b></span><span>AC <b>{character.armorClass}</b></span><span>Hit <b>{signed(character.toHit)}</b></span><span>🪙 <b>{formatGpAsPrice(characterCoinGp(campaign.inventoryManagement, character.id))}</b></span><span>XP <b>{character.currentXp.toLocaleString("en-US")}</b></span></div>{dockedCharacters.length > 1 && <div className="chat-docked-actions"><button aria-label={`Move ${character.name} up`} disabled={index === 0} onClick={() => moveDocked(character.id, -1)}>↑</button><button aria-label={`Move ${character.name} down`} disabled={index === dockedCharacters.length - 1} onClick={() => moveDocked(character.id, 1)}>↓</button><button aria-expanded={!collapsed} onClick={() => toggleDockedCollapsed(character.id)}>{collapsed ? "Expand" : "Collapse"}</button></div>}</div>
            {!collapsed && <><div className="chat-quick-equipment"><label>Weapon<select value={(combatTabActive && campaign.segmentedInitiative.participants.find((participant) => participant.characterId === character.id)?.action === "switch-weapon" ? campaign.segmentedInitiative.participants.find((participant) => participant.characterId === character.id)?.pendingWeaponId : character.equippedWeaponId) ?? "unarmed"} onChange={(event) => switchDockedWeapon(character, event.target.value)}>{availableCharacterWeapons(character).map((weapon) => <option value={weapon.id} key={weapon.id}>{weapon.name}{getWeaponTrainingState(character, weapon).specialized ? " · specialized" : ""}</option>)}</select></label>{sharedAttack ? <button disabled={sharedAttack.disabled} onClick={() => requestSharedAttack(sharedAttack)}>🎲 {sharedAttack.label}</button> : <button disabled={combatTabActive || (!campaign.segmentedInitiative.houseRuleHitDieDamage && !characterWeapon(character, character.equippedWeaponId)?.damage.trim())} onClick={() => rollEquippedAttack(character)}>🎲 {combatTabActive ? "ROLL ATTACK [—]" : "Roll attack"}</button>}</div>
            <div className="quick-roll-grid">{abilityNames.map((stat, statIndex) => <button title="Click: full roll · Shift: roll under · Ctrl: post score" onClick={(event) => event.ctrlKey ? postMessage(`${character.name} · ${stat}: ${character.stats[statIndex]}`, null, { actor: character }) : event.shiftKey ? rollUnder(character, statIndex) : rollFullAbility(character, statIndex)} key={stat}>{abilityIcons[statIndex]}{stat} {character.stats[statIndex]}</button>)}{saveLabels.map(([save, label, icon]) => <button title={`${label} saving throw`} onClick={(event) => event.ctrlKey ? postMessage(`${character.name} · ${label} save target: ${character.saves[save]}`, null, { actor: character }) : rollSave(character, save, label)} key={save}>{icon}{label} {character.saves[save]}+</button>)}</div>
            {character.diceMacros.filter((macro) => macro.name.trim() && macro.expression.trim()).length > 0 && <div className="chat-macro-grid">{character.diceMacros.map((macro, macroIndex) => macro.name.trim() && macro.expression.trim() ? <button onClick={() => rollMacro(character, macroIndex)} key={macroIndex}><b>{macro.name}</b><small>{macro.expression}</small></button> : null)}</div>}</>}
          </article>;
        })}</section>}

        <div className="chat-messages-shell">
          <div className="chat-messages" ref={messagesRef} onScroll={trackChatScroll} aria-live="polite">{messages.length === 0 ? <div className="chat-empty">No visible messages yet. Roll something or say hello.</div> : messages.map((message, messageIndex) => { const toneClass = message.tone === "psionic-hostile" ? "hostile psionic psionic-hostile" : message.tone === "psionic" ? "psionic" : message.tone === "hostile" ? "hostile" : ""; return <article className={`chat-message ${toneClass} ${messageIndex < messages.length - 3 ? "older-message" : ""} ${freshMessageId === message.id ? "fresh" : ""}`} style={characterTileStyle(message.color)} key={message.id}><span className="chat-message-emoji">{message.emoji}</span><div><header><strong>{message.authorName}</strong><span>{message.visibility === "private" ? "🔒 Hidden roll" : message.visibility === "whisper" ? `🤫 To ${message.recipientName || "player"}` : ""}</span><time>{new Date(message.createdAt.endsWith("Z") ? message.createdAt : `${message.createdAt}Z`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></header><div className="chat-message-content">{message.content.split("\n").map((line, index) => <span className={`${line.startsWith("✅") ? "roll-line success" : line.startsWith("❌") ? "roll-line failure" : line.startsWith("🎯") ? "roll-line headshot" : line.startsWith("🎲") ? "roll-line heading" : "roll-line"}${line.startsWith("RESULT —") || line.startsWith("TOTAL —") || line.startsWith("Total:") ? " total" : ""}`} key={`${message.id}-${index}`}>{renderRollMarkup(line)}</span>)}</div></div></article>; })}</div>
          {!role && preferencesReady && <section className="chat-role-onboarding" aria-label="Choose party chat identity"><strong>I am a…</strong>{!choosingPartyCharacters ? <div><button type="button" onClick={() => setChoosingPartyCharacters(true)}>Party Member</button><button type="button" onClick={() => setRole("gm")}>GM</button><button type="button" onClick={() => setRole("solo")}>Solo</button></div> : <><span>Choose your character(s).</span><div className="chat-onboarding-characters">{activeCharacters.length === 0 ? <em>No characters are available.</em> : activeCharacters.map((character) => <label style={characterTileStyle(character.tileColor)} key={character.id}><input type="checkbox" checked={dockedIds.includes(character.id)} onChange={() => toggleDock(character.id)} /><span>{character.emoji}</span><b>{character.name}</b></label>)}</div><footer><button type="button" onClick={() => setChoosingPartyCharacters(false)}>Back</button><button className="primary-button" type="button" disabled={activeCharacters.length > 0 && dockedIds.length === 0} onClick={() => { setRole("party-member"); setChoosingPartyCharacters(false); }}>Use this identity</button></footer></>}</section>}
          {raisedHands.length > 0 && <div className="raised-hands-overlay" aria-label="Raised hands">{raisedHands.map((hand) => <button style={characterTileStyle(hand.color)} aria-disabled={!hasGmPermissions && hand.clientId !== clientId} title={hand.playerName} aria-label={`${hand.playerName} has raised a hand${hasGmPermissions || hand.clientId === clientId ? "; click to dismiss" : ""}`} onClick={() => { if (hasGmPermissions || hand.clientId === clientId) void setHand(false, hand.clientId); }} key={hand.clientId}>✋</button>)}</div>}
        </div>

        <section className={`chat-dice-tray ${rolling ? "rolling" : ""}`}>
          <div className="chat-dice-settings"><label>Number of dice<span><button aria-label="Remove one die" onClick={() => setDiceCount((value) => Math.max(1, value - 1))}>−</button><input aria-label="Number of dice" type="number" min="1" max="20" value={diceCount} onChange={(event) => setDiceCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /><button aria-label="Add one die" onClick={() => setDiceCount((value) => Math.min(20, value + 1))}>+</button></span></label><label>Modifier<span><button aria-label="Subtract one from modifier" onClick={() => setDiceModifier((value) => value - 1)}>−</button><input aria-label="Dice modifier" type="number" value={diceModifier} onChange={(event) => setDiceModifier(Number(event.target.value) || 0)} /><button aria-label="Add one to modifier" onClick={() => setDiceModifier((value) => value + 1)}>+</button></span></label></div>
          <div className="chat-dice-buttons">{diceSizes.map((size) => <button onClick={() => rollDice(diceCount, size, diceModifier)} key={size}>d{size}</button>)}</div>
        </section>

        <div className="chat-compose-stack">
          <form className="chat-compose" onSubmit={submitDraft}><input aria-label="Party chat message or dice expression" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={whisperTarget ? `Whisper to ${whisperPlayers.find((player) => player.id === whisperTarget)?.name ?? "player"}` : hasGmPermissions ? "Message or dice expression" : "Message, d20, or [inline dice]"} maxLength={500} disabled={!role} /><button className="primary-button" type="submit" disabled={!role || !draft.trim()}>Send</button></form>
          <div className="chat-bottom-tools">
            <button className={`chat-tool-icon ${hiddenRoll ? "active" : ""}`} type="button" title={hiddenRoll ? "Hidden roll on" : "Hidden roll off"} aria-label={hiddenRoll ? "Disable hidden roll" : "Enable hidden roll"} aria-pressed={hiddenRoll} onClick={() => setHiddenRoll((current) => !current)}>👁️</button>
            {hasGmPermissions && <details className={`chat-tool-menu whisper-tool ${whisperTarget ? "active" : ""}`}><summary title="Whisper" aria-label="Whisper">🤫</summary><div><label>Whisper to<select aria-label="Whisper recipient" value={whisperTarget} onChange={(event) => setWhisperTarget(event.target.value)}><option value="">Public message</option>{whisperPlayers.map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}</select></label></div></details>}
            <details className="chat-tool-menu dice-syntax-help"><summary title="Dice expression help" aria-label="Dice and command help">🎲</summary><p><code>2d6+3</code> math · <code>4d6kh3</code> keep highest · <code>4d6d1</code> drop lowest · <code>d6!</code> explode · <code>10d6&gt;&gt;4</code> count 4+ · <code>6#4d6d1</code> repeat · <code>dF</code> Fate · <code>[d20]</code> inline.<br /><code>/name</code> any name · <code>/namem</code> male · <code>/namef</code> female.</p></details>
            <button className={`raise-hand-button ${raisedHands.some((hand) => hand.clientId === clientId) ? "hand-raised" : ""}`} title={raisedHands.some((hand) => hand.clientId === clientId) ? "Lower my hand" : "Raise hand"} aria-label={raisedHands.some((hand) => hand.clientId === clientId) ? "Lower my hand" : "Raise hand"} onClick={() => void setHand(!raisedHands.some((hand) => hand.clientId === clientId))}>✋</button>
          </div>
        </div>
        {status && <span className="chat-status" role="status">{status}</span>}
      </div>
    </aside>
  </>;
}
