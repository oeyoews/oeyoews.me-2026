import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'
import { blogContentConfig } from './src/blog/config'

const ROUTE_SUFFIX = '/__dev/api/blog-md'
const ROUTE_PATH_SUFFIX = '/__dev/api/blog-md-path'
const ROUTE_OPEN_LOCAL_SUFFIX = '/__dev/api/blog-open-local'

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function resolveSafeMarkdownPath(root: string, sourcePath: string): string | null {
  const normalized = sourcePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized) return null

  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) return null
  if (segments.some((s) => s === '..' || s === '.' || s.includes('\0'))) return null

  const last = segments[segments.length - 1]
  if (!last.endsWith('.md')) return null

  const contentRoot = path.resolve(root, blogContentConfig.contentDirName)
  const abs = path.resolve(contentRoot, ...segments)
  const rel = path.relative(contentRoot, abs)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null

  return abs
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
