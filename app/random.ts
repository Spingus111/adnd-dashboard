const UINT32_RANGE = 0x1_0000_0000;

function cryptoUint32() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) return cryptoApi.getRandomValues(new Uint32Array(1))[0];
  return null;
}

/** Cryptographically strong unit random value for rules that accept an injected RNG. */
export function secureRandomFloat() {
  const value = cryptoUint32();
  return value === null ? Math.random() : value / UINT32_RANGE;
}

/** Uniform integer with rejection sampling, avoiding modulo bias for physical dice. */
export function secureRandomInteger(maxExclusive: number) {
  const maximum = Math.max(1, Math.trunc(maxExclusive));
  const limit = UINT32_RANGE - (UINT32_RANGE % maximum);
  let value = cryptoUint32();
  if (value === null) return Math.floor(Math.random() * maximum);
  while (value >= limit) value = cryptoUint32()!;
  return value % maximum;
}

export function rollSecureDie(sides: number) {
  return secureRandomInteger(Math.max(1, Math.trunc(sides))) + 1;
}

export function secureRandomIndex(length: number) {
  return secureRandomInteger(Math.max(1, Math.trunc(length)));
}
