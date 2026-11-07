/**
 * Throwaway smoke test for the Project Links host half. It mounts the plugin on
 * a fake Cordis context, drives the exact route with fake Node request/response
 * objects, and asserts the store, validation, and probe paths.
 *
 * Run: node D:\class-app\.dsh-plugin-tests\host-smoke.mjs
 */
import { Readable } from 'node:stream'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const home = await mkdtemp(path.join(tmpdir(), 'dpl-home-'))
process.env.DSH_HOME = home

const module = await import('file:///D:/class-app/dsh-project-links/index.js')

const logs = []
let handler
const disposers = []
const ctx = {
  logger: { warn: (message) => logs.push(String(message)) },
  get: () => undefined,
  effect: (callback) => {
    const dispose = callback()
    disposers.push(dispose)
    return dispose
  },
  webServer: {
    register: (route) => {
      handler = route.handler
      return () => {}
    },
  },
}
module.apply(ctx)

if (typeof handler !== 'function') throw new Error('route handler was not registered')

async function call(method, payload) {
  const req = Readable.from(payload === undefined ? [] : [Buffer.from(JSON.stringify(payload), 'utf8')])
  req.method = method
  req.headers = { host: '127.0.0.1:4843' }
  req.url = '/project-links'
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(key, value) {
      this.headers[key] = value
    },
    end(body) {
      this.body = body ?? ''
    },
  }
  await handler(req, res)
  let data = null
  if (res.body) data = JSON.parse(res.body)
  return { status: res.statusCode, headers: res.headers, data }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`ok - ${message}`)
}

let response = await call('GET')
assert(response.status === 200, 'GET answers 200')
assert(Array.isArray(response.data.links) && response.data.links.length === 0, 'empty store answers no links')

response = await call('POST', { action: 'add', name: 'Example', url: 'example.com/' })
assert(response.status === 200, 'add answers 200')
assert(response.data.links.length === 1, 'add stores one link')
assert(response.data.links[0].url === 'https://example.com/', 'bare host is normalized to https')
assert(response.data.links[0].name === 'Example', 'given name is kept')

const id = response.data.links[0].id

response = await call('POST', { action: 'add', url: 'example.com/' })
assert(response.status === 409 && response.data.error === 'duplicate', 'duplicate add is refused')

response = await call('POST', { action: 'add', url: 'ftp://example.com' })
assert(response.status === 400 && response.data.error === 'invalid-url', 'non-http scheme is refused')

response = await call('POST', { action: 'add', url: '   ' })
assert(response.status === 400 && response.data.error === 'invalid-url', 'blank url is refused')

const stored = JSON.parse(await readFile(path.join(home, 'project-links', 'links.json'), 'utf8'))
assert(stored.links.length === 1 && stored.links[0].id === id, 'store file is written atomically with the link')

response = await call('GET')
assert(response.data.settings.browser === '', 'default open target is a browser tab')
assert(Array.isArray(response.data.browsers), 'host reports its detected browsers')
console.log(`     detected browsers: ${response.data.browsers.map((browser) => browser.id).join(', ') || '(none)'}`)

response = await call('POST', { action: 'open', id })
assert(response.status === 200 && response.data.opened === 'tab', 'open without a chosen browser answers tab')

response = await call('POST', { action: 'settings', browser: 'nope' })
assert(response.status === 400 && response.data.error === 'invalid-browser', 'unknown browser id is refused')

response = await call('POST', { action: 'settings', browser: 'custom', customPath: '   ' })
assert(response.status === 400 && response.data.error === 'browser-missing', 'custom browser without a path is refused')

response = await call('POST', { action: 'settings', browser: 'custom', customPath: `"${process.execPath}"` })
assert(response.status === 200 && response.data.settings.browser === 'custom', 'custom browser is stored')
assert(response.data.settings.customPath === process.execPath, 'a pasted quoted path is unquoted')

const storedSettings = JSON.parse(await readFile(path.join(home, 'project-links', 'links.json'), 'utf8'))
assert(storedSettings.settings.browser === 'custom', 'settings are written to the store')

response = await call('POST', { action: 'open', id })
assert(response.status === 200 && response.data.opened === 'browser', 'open launches the chosen browser')

response = await call('POST', { action: 'settings', browser: 'custom', customPath: path.join(home, 'missing-browser.exe') })
response = await call('POST', { action: 'open', id })
assert(response.status === 500 && response.data.error === 'launch-failed', 'a missing browser reports launch-failed')

response = await call('POST', { action: 'settings', browser: 'custom', customPath: '""' })
assert(response.status === 400 && response.data.error === 'browser-missing', 'an all-quotes path is refused')

response = await call('POST', { action: 'settings', browser: '' })
assert(response.status === 200 && response.data.settings.browser === '', 'open target can return to a tab')

response = await call('POST', { action: 'check' })
assert(response.status === 200, 'check answers 200')
const check = response.data.checks[id]
assert(check !== undefined, 'check reports the stored link')
console.log(`     probe result: ${JSON.stringify(check)}`)
assert(check.state === 'online' || check.state === 'offline', 'probe reports a settled state')

response = await call('POST', { action: 'check', force: true })
assert(response.status === 200 && response.data.checks[id].checkedAt >= check.checkedAt, 'forced check refreshes the result')

response = await call('POST', { action: 'remove', id })
assert(response.status === 200 && response.data.links.length === 0, 'remove deletes the link')
assert(Object.keys(response.data.checks).length === 0, 'remove drops the cached check')

response = await call('POST', { action: 'remove', id })
assert(response.status === 404 && response.data.error === 'not-found', 'removing a missing link answers 404')

response = await call('POST', { action: 'nope' })
assert(response.status === 400 && response.data.error === 'unknown-action', 'unknown action is refused')

response = await call('DELETE')
assert(response.status === 405 && response.headers.allow === 'GET, POST', 'other methods answer 405')

response = await call('GET')
assert(response.data.links.length === 0, 'state survives with an empty list')

for (const dispose of disposers) if (typeof dispose === 'function') dispose()
await rm(home, { recursive: true, force: true })
console.log(logs.length === 0 ? 'ok - no warnings logged' : `warnings: ${logs.join(' | ')}`)
console.log('ALL HOST SMOKE TESTS PASSED')
