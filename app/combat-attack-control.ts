"use client";

export type SharedAttackControl = {
  characterId: string;
  participantId: string;
  eventKey: string;
  label: string;
  disabled: boolean;
};

const STATE_EVENT = "adnd-shared-attack-controls";
const REQUEST_EVENT = "adnd-shared-attack-request";
let controls: SharedAttackControl[] = [];

export function publishAttackControls(next: SharedAttackControl[]) {
  controls = next;
  window.dispatchEvent(new Event(STATE_EVENT));
}

export function attackControlForCharacter(characterId: string) {
  return controls.find((entry) => entry.characterId === characterId) ?? null;
}

export function subscribeAttackControls(listener: () => void) {
  window.addEventListener(STATE_EVENT, listener);
  return () => window.removeEventListener(STATE_EVENT, listener);
}

export function requestSharedAttack(control: SharedAttackControl) {
  window.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: { participantId: control.participantId, eventKey: control.eventKey } }));
}

export function subscribeAttackRequests(listener: (detail: { participantId: string; eventKey: string }) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<{ participantId: string; eventKey: string }>).detail);
  window.addEventListener(REQUEST_EVENT, handler);
  return () => window.removeEventListener(REQUEST_EVENT, handler);
}
