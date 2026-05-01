const BASE_URL = import.meta.env.BASE_URL || '/'

export function withBaseUrl(path: string) {
  const normalizedBase = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`
  return `${normalizedBase}${path.replace(/^\/+/, '')}`
}
