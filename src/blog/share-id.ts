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

function fnv1aHash(input: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function normalizeSharePassword(password: string) {
  return password.trim()
}

export function encodeShareToken(hashid: string, password?: string) {
  const n = parseBase36Uint(hashid)
  if (n === undefined) return ''

  const normalizedPassword = normalizeSharePassword(password ?? '')
  if (!normalizedPassword) {
    return base62Encode(n)
  }

  const digest = fnv1aHash(normalizedPassword)
  const masked = (n ^ digest) >>> 0
  return `p${base62Encode(masked)}.${base62Encode(digest)}`
}

export function decodeShareToken(token: string) {
  const trimmed = token.trim()
  const protectedMatch = /^p([0-9a-zA-Z]+)\.([0-9a-zA-Z]+)$/.exec(trimmed)
  if (protectedMatch) {
    const masked = base62Decode(protectedMatch[1])
    const digest = base62Decode(protectedMatch[2])
    if (masked === undefined || digest === undefined) return { hashid: undefined, passwordDigest: undefined }
    if (masked < 0 || masked > 0xffffffff || digest < 0 || digest > 0xffffffff) {
      return { hashid: undefined, passwordDigest: undefined }
    }
    const n = (masked ^ digest) >>> 0
    return { hashid: n.toString(36), passwordDigest: digest }
  }

  return { hashid: decodeShareId(trimmed), passwordDigest: undefined }
}

export function verifySharePassword(input: string, digest: number) {
  return fnv1aHash(normalizeSharePassword(input)) === digest
}

