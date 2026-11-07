/**
 * Project Links — Host half.
 *
 * Owns the durable link store, the reachability checks the browser half cannot
 * perform (CORS and page CSP do not apply here), and the optional launch of a
 * user-chosen browser. The browser half calls the single exact route
 * `GET|POST /project-links`; every request passes Connection's browser trust
 * fence, so only this page's browser may read or change the links.
 *
 * Store: `$DSH_HOME/project-links/links.json` (default `~/.dsh/...`), written
 * atomically. Checks live in memory only: they are observations, not data.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

/** Exact route the browser half calls; `client.js` holds the browser-relative form. */
export const ROUTE = '/project-links'

/** Hard dependency: without the Web carrier there is no browser to serve. */
export const inject = ['webServer']

/** Request bodies are one small JSON object; anything larger is refused. */
const MAX_BODY_BYTES = 64 * 1024
/** One reachability probe's ceiling before the link is reported offline. */
const CHECK_TIMEOUT_MS = 6000
/** Cached probe results younger than this are reused unless a check is forced. */
const CHECK_TTL_MS = 30000
/** Longest stored display name. */
const MAX_NAME_LENGTH = 120
/** Longest accepted custom browser command. */
const MAX_COMMAND_LENGTH = 1024

/** The open target chosen by the user; empty means a new browser tab in the app. */
const DEFAULT_SETTINGS = { browser: '', customPath: '' }

/** Store file under the resolved Harness home. */
function storeFile() {
  const configured = (process.env.DSH_HOME ?? '').trim()
  const home = configured === '' ? path.join(homedir(), '.dsh') : configured
  return path.join(home, 'project-links', 'links.json')
}

/** A validation failure whose `code` the browser half localizes. */
function fail(code) {
  const error = new Error(code)
  error.code = code
  throw error
}

/** Accept a bare host too, but store only an absolute http(s) URL. */
function normalizeUrl(value) {
  if (typeof value !== 'string') fail('invalid-url')
  const trimmed = value.trim()
  if (trimmed === '') fail('invalid-url')
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url
  try {
    url = new URL(withScheme)
  } catch {
    fail('invalid-url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') fail('invalid-url')
  if (url.hostname === '') fail('invalid-url')
  return url.toString()
}

/** Keep only well-formed stored rows so a hand-edited file cannot break the page. */
function sanitizeLink(row) {
  if (row === null || typeof row !== 'object') return undefined
  if (typeof row.id !== 'string' || row.id === '') return undefined
  if (typeof row.url !== 'string') return undefined
  let url
  try {
    url = new URL(row.url)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  const name = typeof row.name === 'string' && row.name.trim() !== '' ? row.name.trim() : url.hostname
  const addedAt = typeof row.addedAt === 'number' && Number.isFinite(row.addedAt) ? row.addedAt : 0
  return { id: row.id, name: name.slice(0, MAX_NAME_LENGTH), url: url.toString(), addedAt }
}

/** Validate the persisted open target. */
function sanitizeSettings(row) {
  if (row === null || typeof row !== 'object') return { ...DEFAULT_SETTINGS }
  const browser = typeof row.browser === 'string' ? row.browser.trim() : ''
  const customPath = typeof row.customPath === 'string' ? row.customPath.trim() : ''
  return { browser, customPath }
}

/** Trim a pasted quoted path so Explorer's "Copy as path" pastes work. */
function unquote(value) {
  return value.replace(/^["']/, '').replace(/["']$/, '').trim()
}

/** The browsers this Host can launch, in menu order. Commands stay on this side. */
function detectBrowsers() {
  const found = []
  const push = (id, label, command, args = []) => {
    if (command !== undefined && command !== '') found.push({ id, label, command, args })
  }
  const exists = (file) => {
    try {
      return typeof file === 'string' && file !== '' && existsSync(file)
    } catch {
      return false
    }
  }
  const first = (...files) => files.find(exists)
  const env = process.env

  if (process.platform === 'win32') {
    const programFiles = env.ProgramFiles
    const programFilesX86 = env['ProgramFiles(x86)']
    const localAppData = env.LOCALAPPDATA
    const under = (root, ...rest) => (root === undefined || root === '' ? undefined : path.join(root, ...rest))
    const chrome = first(
      under(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      under(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      under(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    )
    if (chrome !== undefined) push('chrome', 'Google Chrome', chrome)
    const edge = first(
      under(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      under(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    )
    if (edge !== undefined) push('edge', 'Microsoft Edge', edge)
    const firefox = first(
      under(programFiles, 'Mozilla Firefox', 'firefox.exe'),
      under(programFilesX86, 'Mozilla Firefox', 'firefox.exe'),
    )
    if (firefox !== undefined) push('firefox', 'Mozilla Firefox', firefox)
    const brave = first(
      under(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
      under(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    )
    if (brave !== undefined) push('brave', 'Brave', brave)
    const vivaldi = under(localAppData, 'Vivaldi', 'Application', 'vivaldi.exe')
    if (exists(vivaldi)) push('vivaldi', 'Vivaldi', vivaldi)
  } else if (process.platform === 'darwin') {
    const apps = [
      ['chrome', 'Google Chrome', '/Applications/Google Chrome.app'],
      ['edge', 'Microsoft Edge', '/Applications/Microsoft Edge.app'],
      ['firefox', 'Firefox', '/Applications/Firefox.app'],
      ['brave', 'Brave Browser', '/Applications/Brave Browser.app'],
      ['safari', 'Safari', '/Applications/Safari.app'],
    ]
    for (const [id, label, bundle] of apps) {
      if (exists(bundle)) push(id, label, 'open', ['-a', label])
    }
  } else {
    const directories = (env.PATH ?? '').split(path.delimiter).filter((entry) => entry !== '')
    const onPath = (names) => {
      for (const directory of directories) {
        for (const name of names) {
          const candidate = path.join(directory, name)
          if (exists(candidate)) return candidate
        }
      }
      return undefined
    }
    const chrome = onPath(['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'])
    if (chrome !== undefined) push('chrome', 'Chromium', chrome)
    const firefox = onPath(['firefox'])
    if (firefox !== undefined) push('firefox', 'Firefox', firefox)
    const brave = onPath(['brave-browser', 'brave'])
    if (brave !== undefined) push('brave', 'Brave', brave)
  }
  return found
}

/** Start the browser without keeping the Host attached. Rejects when the process is missing. */
function launchBrowser(spec, url) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(spec.command, [...(spec.args ?? []), url], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
    } catch (error) {
      reject(error)
      return
    }
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

/** Answer one request with JSON. */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

/** Read one bounded JSON request body. */
async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) fail('too-large')
    chunks.push(chunk)
  }
  if (total === 0) return null
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    fail('invalid-json')
  }
}

/**
 * Host plugin body: load the store, serve the route, probe and launch on demand.
 * @param {import('@deepseek-ai/cordis').Context} ctx - owning host context.
 */
export function apply(ctx) {
  /** id -> last probe result. */
  const checks = new Map()
  /** id -> in-flight probe promise, so two open pages share one request. */
  const inflight = new Map()
  /** Installed browsers, detected once per activation. */
  const browsers = detectBrowsers()
  /** Loaded store; `null` until the first read. */
  let data = null
  /** Serializes store writes and mutations. */
  let queue = Promise.resolve()

  const warn = (message) => {
    if (ctx.logger?.warn !== undefined) ctx.logger.warn(message)
    else console.warn(message)
  }

  const serialize = (operation) => {
    const run = queue.then(operation, operation)
    queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const load = async () => {
    if (data !== null) return data
    let raw
    try {
      raw = await readFile(storeFile(), 'utf8')
    } catch (error) {
      if (error?.code !== 'ENOENT') warn(`project-links: cannot read links store: ${String(error?.message ?? error)}`)
      data = { links: [], settings: { ...DEFAULT_SETTINGS } }
      return data
    }
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      warn('project-links: links store is not valid JSON; starting empty')
      data = { links: [], settings: { ...DEFAULT_SETTINGS } }
      return data
    }
    const rows = Array.isArray(parsed?.links) ? parsed.links : []
    const settings = sanitizeSettings(parsed?.settings)
    if (settings.browser !== '' && settings.browser !== 'custom' && !browsers.some((browser) => browser.id === settings.browser)) {
      settings.browser = ''
    }
    data = {
      links: rows.map(sanitizeLink).filter((row) => row !== undefined),
      settings,
    }
    return data
  }

  const persist = async (next) => {
    const file = storeFile()
    await mkdir(path.dirname(file), { recursive: true })
    const temporary = `${file}.${String(process.pid)}.tmp`
    const payload = { version: 2, links: next.links, settings: next.settings }
    await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    await rename(temporary, file)
    data = next
  }

  /** Point-in-time probe results for the current rows. */
  const snapshot = () => {
    const value = {}
    for (const row of data?.links ?? []) {
      const check = checks.get(row.id)
      if (check !== undefined) value[row.id] = check
    }
    return value
  }

  /** Probe one link, reusing the cached result or the in-flight probe. */
  const checkLink = async (link, force) => {
    const cached = checks.get(link.id)
    if (!force && cached !== undefined && Date.now() - cached.checkedAt < CHECK_TTL_MS) return cached
    const running = inflight.get(link.id)
    if (running !== undefined) return running
    const run = (async () => {
      const startedAt = Date.now()
      const result = { state: 'offline', status: null, latencyMs: null, checkedAt: startedAt, error: null }
      try {
        const response = await fetch(link.url, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
          headers: {
            accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
            'user-agent': 'dsh-project-links/1.0 (reachability probe)',
          },
        })
        result.state = 'online'
        result.status = response.status
        result.latencyMs = Date.now() - startedAt
        result.checkedAt = Date.now()
        try {
          await response.body?.cancel()
        } catch {
          // The connection is settled; the body is never needed.
        }
      } catch (error) {
        result.state = 'offline'
        result.latencyMs = Date.now() - startedAt
        result.checkedAt = Date.now()
        const name = error?.name
        result.error =
          name === 'TimeoutError' || name === 'AbortError'
            ? 'timeout'
            : String(error?.cause?.code ?? error?.code ?? error?.message ?? 'unreachable')
      }
      checks.set(link.id, result)
      return result
    })()
    inflight.set(link.id, run)
    try {
      return await run
    } finally {
      inflight.delete(link.id)
    }
  }

  /** The launch target for the current settings, or null for a browser tab. */
  const resolveBrowser = (settings) => {
    if (settings.browser === '') return null
    if (settings.browser === 'custom') {
      const command = unquote(settings.customPath)
      if (command === '') fail('browser-missing')
      return { id: 'custom', label: command, command, args: [] }
    }
    const entry = browsers.find((browser) => browser.id === settings.browser)
    if (entry === undefined) fail('browser-missing')
    return entry
  }

  /** Browser-visible state; launch commands never leave this process. */
  const state = async () => ({
    links: data.links,
    checks: snapshot(),
    settings: { browser: data.settings.browser, customPath: data.settings.customPath },
    browsers: browsers.map((browser) => ({ id: browser.id, label: browser.label })),
  })

  const addLink = async (payload) => {
    const url = normalizeUrl(payload?.url)
    await load()
    if (data.links.some((row) => row.url === url)) fail('duplicate')
    const name =
      typeof payload?.name === 'string' && payload.name.trim() !== ''
        ? payload.name.trim().slice(0, MAX_NAME_LENGTH)
        : new URL(url).hostname.replace(/^www\./, '')
    const link = { id: randomUUID(), name, url, addedAt: Date.now() }
    await persist({ ...data, links: [...data.links, link] })
    return state()
  }

  const removeLink = async (payload) => {
    await load()
    const id = typeof payload?.id === 'string' ? payload.id : ''
    const next = data.links.filter((row) => row.id !== id)
    if (next.length === data.links.length) fail('not-found')
    checks.delete(id)
    await persist({ ...data, links: next })
    return state()
  }

  const updateSettings = async (payload) => {
    await load()
    const requested = typeof payload?.browser === 'string' ? payload.browser : ''
    if (requested !== '' && requested !== 'custom' && !browsers.some((browser) => browser.id === requested)) {
      fail('invalid-browser')
    }
    let customPath = data.settings.customPath
    if (typeof payload?.customPath === 'string') customPath = unquote(payload.customPath).slice(0, MAX_COMMAND_LENGTH)
    if (requested === 'custom' && customPath === '') fail('browser-missing')
    await persist({ ...data, settings: { browser: requested, customPath } })
    return state()
  }

  const openLink = async (payload) => {
    await load()
    const link = data.links.find((row) => row.id === payload?.id)
    if (link === undefined) fail('not-found')
    const spec = resolveBrowser(data.settings)
    if (spec === null) return { opened: 'tab', url: link.url }
    try {
      await launchBrowser(spec, link.url)
    } catch (error) {
      warn(`project-links: cannot launch ${spec.command}: ${String(error?.message ?? error)}`)
      fail('launch-failed')
    }
    return { opened: 'browser', browser: spec.id }
  }

  const checkAll = async (payload) => {
    const force = payload?.force === true
    await load()
    await Promise.all(data.links.map((row) => checkLink(row, force)))
    return state()
  }

  const handler = async (req, res) => {
    const connection = ctx.get('connection')
    try {
      const rejection = connection?.requestRejection?.(req)
      if (rejection !== undefined) {
        res.statusCode = rejection
        res.end()
        return
      }
    } catch {
      res.statusCode = 403
      res.end()
      return
    }
    if (req.method === 'GET') {
      try {
        await load()
        sendJson(res, 200, await state())
      } catch (error) {
        warn(`project-links: state read failed: ${String(error?.message ?? error)}`)
        sendJson(res, 500, { error: 'unavailable' })
      }
      return
    }
    if (req.method !== 'POST') {
      res.setHeader('allow', 'GET, POST')
      res.statusCode = 405
      res.end()
      return
    }
    let payload
    try {
      payload = await readJson(req)
    } catch (error) {
      sendJson(res, error?.code === 'too-large' ? 413 : 400, { error: error?.code ?? 'invalid-json' })
      return
    }
    const action = payload?.action
    try {
      let value
      if (action === 'add') value = await serialize(() => addLink(payload))
      else if (action === 'remove') value = await serialize(() => removeLink(payload))
      else if (action === 'settings') value = await serialize(() => updateSettings(payload))
      else if (action === 'open') value = await openLink(payload)
      else if (action === 'check') value = await checkAll(payload)
      else {
        sendJson(res, 400, { error: 'unknown-action' })
        return
      }
      sendJson(res, 200, value)
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : 'unavailable'
      const badRequest = new Set(['invalid-url', 'invalid-json', 'too-large', 'invalid-browser', 'browser-missing'])
      const status = badRequest.has(code) ? 400 : code === 'duplicate' ? 409 : code === 'not-found' ? 404 : 500
      if (status === 500) warn(`project-links: ${String(action)} failed: ${String(error?.message ?? error)}`)
      sendJson(res, status, { error: code })
    }
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: ROUTE, handler }),
    `project-links: GET/POST ${ROUTE}`,
  )
}
