/**
 * Generator močnih gesel za admin ponastavitev gesla članu.
 *
 * Čista funkcija: RNG je injiciran, zato je deterministično testabilna.
 * Privzeti RNG uporablja Web Crypto (crypto.getRandomValues) — varno
 * v brskalniku in Node/Bun izvajalnem okolju.
 */

const LOWER = "abcdefghijkmnopqrstuvwxyz"
// Brez dvoumnih znakov (l, I, O, 0, 1) — lažje ročno prepisovanje.
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ"
const DIGITS = "23456789"
const ALL = LOWER + UPPER + DIGITS

export type RandomBytesFn = (byteCount: number) => Uint8Array

function defaultRandomBytes(byteCount: number): Uint8Array {
  const bytes = new Uint8Array(byteCount)
  crypto.getRandomValues(bytes)
  return bytes
}

/**
 * Vrne močno geslo dolžine `length` (min. 8) z vsaj enim malim črko,
 * enim velikim črko in eno številko.
 */
export function generateStrongPassword(
  length: number = 12,
  randomBytes: RandomBytesFn = defaultRandomBytes
): string {
  if (!Number.isInteger(length) || length < 8) {
    throw new Error("Dolžina gesla mora biti vsaj 8 znakov")
  }

  // Ena številka iz vsakega razreda je zagotovljena vnaprej.
  const pickFrom = (set: string): string => {
    const bytes = randomBytes(1)
    const idx = bytes[0] % set.length
    return set[idx]
  }

  const chars: string[] = [
    pickFrom(LOWER),
    pickFrom(UPPER),
    pickFrom(DIGITS),
  ]

  while (chars.length < length) {
    chars.push(pickFrom(ALL))
  }

  // Fisher–Yates mešanje z injiciranim RNG, da ni predvidljivega vzorca
  // ("prvi trije znaki so vedno mali/veliki/številka").
  for (let i = chars.length - 1; i > 0; i--) {
    const bytes = randomBytes(1)
    const j = bytes[0] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join("")
}
