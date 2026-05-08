import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'
import { blogContentConfig } from './src/blog/config'

const ROUTE_SUFFIX = '/__dev/api/blog-md'
const ROUTE_PATH_SUFFIX = '/__dev/api/blog-md-path'

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
