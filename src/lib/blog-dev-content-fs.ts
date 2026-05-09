import { withBaseUrl } from '@/lib/base-url'

const API = '__dev/api/blog-content-fs'

type FsOk<T extends Record<string, unknown>> = { ok: true } & T
type FsErr = { ok: false; error: string }

async function postFs(body: unknown): Promise<FsOk<Record<string, unknown>> | FsErr> {
  const res = await fetch(withBaseUrl(API), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return { ok: false, error: text || res.statusText || 'invalid response' }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'invalid response' }
  }
  const o = parsed as { ok?: unknown; error?: unknown }
  if (o.ok === true) return parsed as FsOk<Record<string, unknown>>
  if (typeof o.error === 'string') return { ok: false, error: o.error }
  return { ok: false, error: res.ok ? 'unknown error' : text || res.statusText }
}

export type DevFsCreateOk = { ok: true; sourcePath: string }

export async function devFsCreateMarkdown(
  parentRelativeDir: string,
  slug: string,
  raw?: string,
): Promise<FsErr | DevFsCreateOk> {
  const r = await postFs({ action: 'createMarkdown', parentRelativeDir, slug, ...(raw !== undefined ? { raw } : {}) })
  if (!r.ok) return r
  const sourcePath = typeof r.sourcePath === 'string' ? r.sourcePath : null
  if (!sourcePath) return { ok: false, error: 'missing sourcePath in response' }
  return { ok: true, sourcePath }
}

export async function devFsCreateFolder(parentRelativeDir: string, name: string): Promise<FsErr | DevFsCreateOk> {
  const r = await postFs({ action: 'createFolder', parentRelativeDir, name })
  if (!r.ok) return r
  const sourcePath = typeof r.sourcePath === 'string' ? r.sourcePath : null
  if (!sourcePath) return { ok: false, error: 'missing sourcePath in response' }
  return { ok: true, sourcePath }
}

export async function devFsDeleteMarkdown(sourcePath: string) {
  const r = await postFs({ action: 'deleteMarkdown', sourcePath })
  if (!r.ok) return r
  return { ok: true as const }
}

export async function devFsDeleteDirectory(treePathPrefix: string) {
  const r = await postFs({ action: 'deleteDirectory', treePathPrefix })
  if (!r.ok) return r
  return { ok: true as const }
}

export async function devFsRenameOrMove(fromSourcePath: string, toSourcePath: string) {
  const r = await postFs({ action: 'renameOrMove', fromSourcePath, toSourcePath })
  if (!r.ok) return r
  const sourcePath = typeof r.sourcePath === 'string' ? r.sourcePath : undefined
  const treePathPrefix = typeof r.treePathPrefix === 'string' ? r.treePathPrefix : undefined
  return { ok: true as const, sourcePath, treePathPrefix }
}
