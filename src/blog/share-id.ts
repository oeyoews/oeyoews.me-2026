const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function base62Encode(num: number) {
  if (!Number.isFinite(num) || num < 0) return ''
  if (num === 0) return '0'
  let n = Math.floor(num)
  let out = ''
  while (n > 0) {
    const r = n % 62
    out = BASE62_ALPHABET[r] + out
    n = Math.floor(n / 62)
  }
  return out
}

function base62Decode(input: string) {
  if (!input) return undefined
  let n = 0
  for (let i = 0; i < input.length; i += 1) {
    const idx = BASE62_ALPHABET.indexOf(input[i])
    if (idx === -1) return undefined
    n = n * 62 + idx
    if (!Number.isSafeInteger(n)) return undefined
  }
  return n
}

function parseBase36Uint(hashid: string) {
  const trimmed = hashid.trim().toLowerCase()
  if (!/^[0-9a-z]+$/.test(trimmed)) return undefined
  const n = Number.parseInt(trimmed, 36)
  if (!Number.isFinite(n) || n < 0) return undefined
  if (!Number.isSafeInteger(n)) return undefined
  // fnv1aHash() is 32-bit unsigned, keep within that range
  if (n > 0xffffffff) return undefined
  return n
}

/**
 * Stable reversible codec for share links:
 * hashid (base36) <-> shareId (base62)
 */
export function encodeShareId(hashid: string) {
  const n = parseBase36Uint(hashid)
  if (n === undefined) return ''
  return base62Encode(n)
}

export function decodeShareId(shareId: string) {
  const n = base62Decode(shareId.trim())
  if (n === undefined) return undefined
  if (n < 0 || n > 0xffffffff) return undefined
  return n.toString(36)
}

