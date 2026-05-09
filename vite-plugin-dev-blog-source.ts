import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'
import { blogContentConfig } from './src/blog/config'

const ROUTE_SUFFIX = '/__dev/api/blog-md'
const ROUTE_PATH_SUFFIX = '/__dev/api/blog-md-path'
const ROUTE_OPEN_LOCAL_SUFFIX = '/__dev/api/blog-open-local'
const ROUTE_CONTENT_FS_SUFFIX = '/__dev/api/blog-content-fs'

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function getContentRoot(projectRoot: string) {
  return path.resolve(projectRoot, blogContentConfig.contentDirName)
}

/** Normalized relative path under content/ (no leading slash), or "" for content root. Null if invalid. */
export function normalizeRelativeUnderContent(input: string): string | null {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (normalized === '') return ''
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) return ''
  if (segments.some((s) => s === '..' || s === '.' || s.includes('\0'))) return null
  return segments.join('/')
}

function resolveUnderContentDir(projectRoot: string, relativePosixPath: string | null): string | null {
  const rel = relativePosixPath === null ? null : normalizeRelativeUnderContent(relativePosixPath)
  if (rel === null) return null

  const contentRoot = getContentRoot(projectRoot)
  const abs =
    rel === '' ? contentRoot : path.resolve(contentRoot, ...rel.split('/'))
  const back = path.relative(contentRoot, abs)
  if (back.startsWith('..') || path.isAbsolute(back)) return null
  return abs
}

function resolveSafeMarkdownPath(projectRoot: string, sourcePath: string): string | null {
  const normalized = sourcePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized) return null
  const last = normalized.split('/').filter(Boolean).pop()
  if (!last?.endsWith('.md')) return null
  return resolveUnderContentDir(projectRoot, normalized)
}

function pathnameMatchesRoute(url: string | undefined): boolean {
  if (!url) return false
  const pathname = new URL(url, 'http://dev.local').pathname
  return pathname === ROUTE_SUFFIX || pathname.endsWith(ROUTE_SUFFIX)
}

function pathnameMatchesPathRoute(url: string | undefined): boolean {
  if (!url) return false
  const pathname = new URL(url, 'http://dev.local').pathname
  return pathname === ROUTE_PATH_SUFFIX || pathname.endsWith(ROUTE_PATH_SUFFIX)
}

function pathnameMatchesOpenLocalRoute(url: string | undefined): boolean {
  if (!url) return false
  const pathname = new URL(url, 'http://dev.local').pathname
  return pathname === ROUTE_OPEN_LOCAL_SUFFIX || pathname.endsWith(ROUTE_OPEN_LOCAL_SUFFIX)
}

function pathnameMatchesContentFsRoute(url: string | undefined): boolean {
  if (!url) return false
  const pathname = new URL(url, 'http://dev.local').pathname
  return pathname === ROUTE_CONTENT_FS_SUFFIX || pathname.endsWith(ROUTE_CONTENT_FS_SUFFIX)
}

function isDirPrefixInsideOrEqual(prefix: string, candidate: string) {
  return candidate === prefix || candidate.startsWith(`${prefix}/`)
}

function slugifyFilenameBase(name: string): string | null {
  const t = name.trim().replace(/\\/g, '/')
  const base = t.endsWith('.md') ? t.slice(0, -3) : t
  const seg = base.split('/').filter(Boolean).pop() ?? ''
  if (!seg) return null
  if (seg.includes('/') || seg.includes('\\')) return null
  if (seg === '.' || seg === '..') return null
  if (seg.includes('\0')) return null
  return seg
}

function defaultMarkdownTemplate(title: string, dateIso: string) {
  return `---
title: ${title}
date: ${dateIso}
---

`
}

function defaultIndexStub(folderTitle: string, dateIso: string) {
  return defaultMarkdownTemplate(folderTitle, dateIso)
}

async function pathExists(abs: string) {
  try {
    await fs.access(abs)
    return true
  } catch {
    return false
  }
}

type ContentFsBody =
  | { action: 'createMarkdown'; parentRelativeDir?: unknown; slug?: unknown; raw?: unknown }
  | { action: 'createFolder'; parentRelativeDir?: unknown; name?: unknown }
  | { action: 'deleteMarkdown'; sourcePath?: unknown }
  | { action: 'deleteDirectory'; treePathPrefix?: unknown }
  | { action: 'renameOrMove'; fromSourcePath?: unknown; toSourcePath?: unknown }

async function handleContentFs(projectRoot: string, body: string, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (chunk?: string) => void }) {
  let parsed: ContentFsBody
  try {
    parsed = JSON.parse(body) as ContentFsBody
  } catch {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }))
    return
  }

  const action = parsed.action
  const jsonOk = (data: Record<string, unknown>) => {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: true, ...data }))
  }
  const jsonErr = (code: number, message: string) => {
    res.statusCode = code
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: message }))
  }

  try {
    if (action === 'createMarkdown') {
      const parentRaw = typeof parsed.parentRelativeDir === 'string' ? parsed.parentRelativeDir : ''
      const parent = normalizeRelativeUnderContent(parentRaw)
      if (parent === null) return jsonErr(400, 'invalid parentRelativeDir')
      const slug = typeof parsed.slug === 'string' ? slugifyFilenameBase(parsed.slug) : null
      if (!slug) return jsonErr(400, 'invalid slug')
      const rel = parent ? `${parent}/${slug}.md` : `${slug}.md`
      const abs = resolveUnderContentDir(projectRoot, rel)
      if (!abs) return jsonErr(400, 'invalid path')
      if (await pathExists(abs)) return jsonErr(409, 'file already exists')
      const raw =
        typeof parsed.raw === 'string' && parsed.raw.length > 0
          ? parsed.raw
          : defaultMarkdownTemplate(slug.replace(/[-_]/g, ' '), new Date().toISOString().slice(0, 10))
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.writeFile(abs, raw, 'utf8')
      return jsonOk({ sourcePath: rel })
    }

    if (action === 'createFolder') {
      const parentRaw = typeof parsed.parentRelativeDir === 'string' ? parsed.parentRelativeDir : ''
      const parent = normalizeRelativeUnderContent(parentRaw)
      if (parent === null) return jsonErr(400, 'invalid parentRelativeDir')
      const folderName = typeof parsed.name === 'string' ? slugifyFilenameBase(parsed.name) : null
      if (!folderName) return jsonErr(400, 'invalid name')
      const dirRel = parent ? `${parent}/${folderName}` : folderName
      const indexRel = `${dirRel}/index.md`
      const absIndex = resolveUnderContentDir(projectRoot, indexRel)
      if (!absIndex) return jsonErr(400, 'invalid path')
      if (await pathExists(absIndex)) return jsonErr(409, 'folder or index.md already exists')
      await fs.mkdir(path.dirname(absIndex), { recursive: true })
      await fs.writeFile(
        absIndex,
        defaultIndexStub(folderName.replace(/[-_]/g, ' '), new Date().toISOString().slice(0, 10)),
        'utf8',
      )
      return jsonOk({ sourcePath: indexRel, treePathPrefix: dirRel })
    }

    if (action === 'deleteMarkdown') {
      if (typeof parsed.sourcePath !== 'string') return jsonErr(400, 'missing sourcePath')
      const abs = resolveSafeMarkdownPath(projectRoot, parsed.sourcePath)
      if (!abs) return jsonErr(400, 'invalid sourcePath')
      try {
        const st = await fs.stat(abs)
        if (!st.isFile()) return jsonErr(400, 'not a file')
      } catch {
        return jsonErr(404, 'file not found')
      }
      await fs.unlink(abs)
      return jsonOk({ sourcePath: parsed.sourcePath })
    }

    if (action === 'deleteDirectory') {
      if (typeof parsed.treePathPrefix !== 'string') return jsonErr(400, 'missing treePathPrefix')
      const rel = normalizeRelativeUnderContent(parsed.treePathPrefix)
      if (rel === null || rel === '') return jsonErr(400, 'invalid treePathPrefix')
      if (rel.endsWith('.md')) return jsonErr(400, 'use deleteMarkdown for files')
      const abs = resolveUnderContentDir(projectRoot, rel)
      if (!abs) return jsonErr(400, 'invalid path')
      try {
        const st = await fs.stat(abs)
        if (!st.isDirectory()) return jsonErr(400, 'not a directory')
      } catch {
        return jsonErr(404, 'directory not found')
      }
      await fs.rm(abs, { recursive: true, force: true })
      return jsonOk({ treePathPrefix: rel })
    }

    if (action === 'renameOrMove') {
      if (typeof parsed.fromSourcePath !== 'string' || typeof parsed.toSourcePath !== 'string') {
        return jsonErr(400, 'expected fromSourcePath and toSourcePath')
      }
      const fromNorm = normalizeRelativeUnderContent(parsed.fromSourcePath)
      const toNorm = normalizeRelativeUnderContent(parsed.toSourcePath)
      if (fromNorm === null || toNorm === null) return jsonErr(400, 'invalid paths')

      const fromIsFile = fromNorm.endsWith('.md')
      const toIsFile = toNorm.endsWith('.md')
      if (fromIsFile !== toIsFile) return jsonErr(400, 'file/dir mismatch between from and to')

      if (fromIsFile) {
        const absFrom = resolveUnderContentDir(projectRoot, fromNorm)
        const absTo = resolveUnderContentDir(projectRoot, toNorm)
        if (!absFrom || !absTo) return jsonErr(400, 'invalid path')
        if (!(await pathExists(absFrom))) return jsonErr(404, 'source not found')
        if (await pathExists(absTo)) return jsonErr(409, 'target already exists')
        await fs.mkdir(path.dirname(absTo), { recursive: true })
        await fs.rename(absFrom, absTo)
        return jsonOk({ sourcePath: toNorm })
      }

      // directory rename: prefixes without .md
      if (fromNorm.endsWith('.md') || toNorm.endsWith('.md')) {
        return jsonErr(400, 'directory paths must not end with .md')
      }
      const absFrom = resolveUnderContentDir(projectRoot, fromNorm)
      const absTo = resolveUnderContentDir(projectRoot, toNorm)
      if (!absFrom || !absTo) return jsonErr(400, 'invalid path')
      if (isDirPrefixInsideOrEqual(fromNorm, toNorm)) {
        return jsonErr(400, 'cannot move directory into itself or its descendant')
      }
      let stFrom
      try {
        stFrom = await fs.stat(absFrom)
      } catch {
        return jsonErr(404, 'source directory not found')
      }
      if (!stFrom.isDirectory()) return jsonErr(400, 'source is not a directory')
      if (await pathExists(absTo)) return jsonErr(409, 'target already exists')
      await fs.mkdir(path.dirname(absTo), { recursive: true })
      await fs.rename(absFrom, absTo)
      return jsonOk({ treePathPrefix: toNorm })
    }

    return jsonErr(400, 'unknown action')
  } catch (e) {
    return jsonErr(500, e instanceof Error ? e.message : 'operation failed')
  }
}

function spawnDetached(command: string, args: string[], options?: { cwd?: string }) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    ...options,
  })
  child.unref()
}

/** 在系统文件管理器中定位到该文件（Windows：选中；macOS：Finder 中显示；Linux：打开所在目录）。 */
function openExplorerSelectFile(absFilePath: string) {
  const platform = process.platform
  if (platform === 'win32') {
    // explorer 对 CreateProcess 传入的 argv 解析很挑剔；用 shell 拼成一条命令最稳。
    const norm = path.win32.normalize(absFilePath)
    const inner = norm.replace(/"/g, '""')
    const cmdLine = `explorer.exe /select,"${inner}"`
    const child = spawn(cmdLine, [], {
      shell: true,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.on('error', () => {
      spawnDetached(`${process.env.SystemRoot ?? 'C:\\Windows'}\\explorer.exe`, [path.dirname(norm)])
    })
    child.unref()
  } else if (platform === 'darwin') {
    spawnDetached('open', ['-R', absFilePath])
  } else {
    spawnDetached('xdg-open', [path.dirname(absFilePath)])
  }
}

/** 在文件所在目录打开终端（尽力而为，依赖本机已安装的终端）。 */
function openTerminalInDirectory(absDir: string) {
  const platform = process.platform
  if (platform === 'win32') {
    const child = spawn('wt.exe', ['-d', absDir], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.on('error', () => {
      spawnDetached('cmd.exe', ['/c', 'start', 'cmd', '/k', `cd /d ${JSON.stringify(absDir)}`])
    })
    child.unref()
  } else if (platform === 'darwin') {
    spawnDetached('open', ['-a', 'Terminal', '.'], { cwd: absDir })
  } else {
    const g = spawn('gnome-terminal', ['--working-directory', absDir], {
      detached: true,
      stdio: 'ignore',
    })
    g.on('error', () => {
      spawnDetached('x-terminal-emulator', [])
    })
    g.unref()
  }
}

export function devBlogSourcePlugin(): Plugin {
  return {
    name: 'dev-blog-source',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'GET' && pathnameMatchesPathRoute(req.url)) {
          const u = new URL(req.url ?? '/', 'http://dev.local')
          const sourcePath = u.searchParams.get('sourcePath')
          if (!sourcePath) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('missing sourcePath query')
            return
          }
          const absolutePath = resolveSafeMarkdownPath(server.config.root, sourcePath)
          if (!absolutePath) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('invalid sourcePath')
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ absolutePath }))
          return
        }

        if (req.method === 'POST' && pathnameMatchesOpenLocalRoute(req.url)) {
          let body: string
          try {
            body = await readRequestBody(req)
          } catch {
            res.statusCode = 400
            res.end('invalid body')
            return
          }

          let parsed: { sourcePath?: unknown; action?: unknown }
          try {
            parsed = JSON.parse(body) as { sourcePath?: unknown; action?: unknown }
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('invalid json')
            return
          }

          if (typeof parsed.sourcePath !== 'string' || (parsed.action !== 'explorer' && parsed.action !== 'terminal')) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('expected { sourcePath: string, action: "explorer" | "terminal" }')
            return
          }

          const absolutePath = resolveSafeMarkdownPath(server.config.root, parsed.sourcePath)
          if (!absolutePath) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('invalid sourcePath')
            return
          }

          try {
            if (parsed.action === 'explorer') {
              openExplorerSelectFile(absolutePath)
            } else {
              openTerminalInDirectory(path.dirname(absolutePath))
            }
          } catch (e) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end(e instanceof Error ? e.message : 'open failed')
            return
          }

          res.statusCode = 204
          res.end()
          return
        }

        if (req.method === 'POST' && pathnameMatchesContentFsRoute(req.url)) {
          let body: string
          try {
            body = await readRequestBody(req)
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ ok: false, error: 'invalid body' }))
            return
          }
          await handleContentFs(server.config.root, body, res)
          return
        }

        if (req.method !== 'POST' || !pathnameMatchesRoute(req.url)) {
          return next()
        }

        let body: string
        try {
          body = await readRequestBody(req)
        } catch {
          res.statusCode = 400
          res.end('invalid body')
          return
        }

        let parsed: { sourcePath?: unknown; raw?: unknown }
        try {
          parsed = JSON.parse(body) as { sourcePath?: unknown; raw?: unknown }
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('invalid json')
          return
        }

        if (typeof parsed.sourcePath !== 'string' || typeof parsed.raw !== 'string') {
          res.statusCode = 400
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('expected { sourcePath: string, raw: string }')
          return
        }

        const target = resolveSafeMarkdownPath(server.config.root, parsed.sourcePath)
        if (!target) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('invalid sourcePath')
          return
        }

        try {
          await fs.writeFile(target, parsed.raw, 'utf8')
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(e instanceof Error ? e.message : 'write failed')
          return
        }

        res.statusCode = 204
        res.end()
      })
    },
  }
}
