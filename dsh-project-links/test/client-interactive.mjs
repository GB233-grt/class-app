/**
 * Opt-in interactive test for the browser half: it mounts the real panel with
 * react-test-renderer, mocks the Host route, and drives the row click, the
 * open-with selector, and the add form.
 *
 * react-test-renderer is not part of this package. Point DPL_TEST_MODULES at a
 * node_modules directory that contains react@18 and react-test-renderer@18:
 *
 *   $env:DPL_TEST_MODULES = 'C:\path\to\node_modules'
 *   node dsh-project-links\test\client-interactive.mjs
 *
 * Without that variable the test reports SKIPPED and exits 0.
 */
import { createRequire } from 'node:module'
import path from 'node:path'

const modules = process.env.DPL_TEST_MODULES
if (modules === undefined || modules.trim() === '') {
  console.log('SKIPPED client-interactive: set DPL_TEST_MODULES to a node_modules dir with react-test-renderer')
  process.exit(0)
}

const testRequire = createRequire(path.join(modules, 'noop.js'))
const React = testRequire('react')
const TestRenderer = testRequire('react-test-renderer')
const { act } = TestRenderer
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const opens = []
let loaded = null
globalThis.window = {
  open: (...args) => {
    opens.push(args)
    return null
  },
  __ModuleLoader__: {
    load(definition) {
      loaded = definition
    },
  },
}

await import('file:///D:/class-app/dsh-project-links/client.js')

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`)
  console.log(`ok - ${message}`)
}

let links = [{ id: 'a1', name: 'App', url: 'https://example.com/', addedAt: 0 }]
let checks = { a1: { state: 'online', status: 200, latencyMs: 12, checkedAt: 0, error: null } }
let settings = { browser: '', customPath: '' }
const browsers = [{ id: 'chrome', label: 'Google Chrome' }]
const calls = []

const state = () => ({ links, checks, settings, browsers })
const reply = (value) => ({ ok: true, status: 200, json: async () => value })

const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init) => {
  const body = init?.body === undefined ? null : JSON.parse(init.body)
  calls.push({ url, method: init?.method, body })
  if (body === null) return reply(state())
  if (body.action === 'check') return reply(state())
  if (body.action === 'open') return reply({ opened: 'browser', browser: settings.browser })
  if (body.action === 'settings') {
    settings = { browser: body.browser, customPath: body.customPath ?? settings.customPath }
    return reply(state())
  }
  if (body.action === 'add') {
    links = [...links, { id: `added-${links.length}`, name: body.name || 'New', url: body.url, addedAt: 0 }]
    return reply(state())
  }
  if (body.action === 'remove') {
    links = links.filter((row) => row.id !== body.id)
    checks = {}
    return reply(state())
  }
  return reply({ error: 'unknown-action' })
}

const dictionaries = new Map()
let activeLocale = 'zh'
const registered = []
const ctx = {
  effect: (callback) => callback(),
  locale: {
    register(namespace, dicts) {
      dictionaries.set(namespace, dicts)
      return () => {}
    },
    bind(namespace) {
      return (key, values) => {
        const dict = dictionaries.get(namespace)?.[activeLocale] ?? {}
        const template = typeof dict[key] === 'string' ? dict[key] : key
        if (values === undefined) return template
        return template.replace(/\{(\w+)\}/g, (match, name) => (values[name] === undefined ? match : String(values[name])))
      }
    },
  },
  slots: {
    inject: (_key, callback) => callback(),
    register: (options, component) => {
      registered.push({ options, component })
      return () => {}
    },
  },
}

const plugin = loaded.factory(testRequire)
plugin.apply(ctx)

const page = registered.find((entry) => entry.options.name === 'main').component
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

let renderer
await act(async () => {
  renderer = TestRenderer.create(React.createElement(page, {}))
})
await act(async () => {
  await flush()
})

const byClass = (fragment) =>
  renderer.root.findAll((node) => typeof node.props.className === 'string' && node.props.className.includes(fragment))
const buttons = () => renderer.root.findAllByType('button')
const buttonWithText = (text) => buttons().find((button) => button.props.children === text)

const select = renderer.root.findByType('select')
assert(select.props.value === '', 'open-with starts on the new-tab default')
const options = renderer.root.findAllByType('option')
assert(options.length === 3, 'open-with lists the default, detected browsers, and the custom entry')
assert(options[1].props.children === 'Google Chrome', 'detected browser label is offered')

const rows = byClass('dpl-row')
assert(rows.length === 1, 'the stored link renders as a row')
assert(byClass('dpl-status online').length === 1, 'the row shows the online state')

await act(async () => {
  rows[0].props.onClick()
})
assert(opens.length === 1, 'clicking a row with the default target opens a tab')
assert(calls.some((call) => call.body?.action === 'open') === false, 'the default target does not ask the Host')

await act(async () => {
  select.props.onChange({ target: { value: 'chrome' } })
  await flush()
})
const settingsCall = calls.filter((call) => call.body?.action === 'settings').at(-1)
assert(settingsCall?.body.browser === 'chrome', 'choosing a browser saves it')
assert(renderer.root.findByType('select').props.value === 'chrome', 'the selector reflects the saved browser')

await act(async () => {
  byClass('dpl-row')[0].props.onClick()
  await flush()
})
assert(calls.some((call) => call.body?.action === 'open'), 'clicking a row asks the Host to launch the chosen browser')
assert(opens.length === 1, 'the chosen browser replaces the tab')

await act(async () => {
  renderer.root.findByType('select').props.onChange({ target: { value: 'custom' } })
  await flush()
})
const customInput = byClass('dpl-input-custom')
assert(customInput.length === 1, 'the custom browser path field appears')

await act(async () => {
  byClass('dpl-input-custom')[0].props.onChange({ target: { value: 'C:\\Browsers\\chrome.exe' } })
  await flush()
})
await act(async () => {
  buttonWithText('保存').props.onClick()
  await flush()
})
const customCall = calls.filter((call) => call.body?.action === 'settings').at(-1)
assert(customCall?.body.browser === 'custom', 'saving the custom browser posts the custom choice')
assert(customCall?.body.customPath === 'C:\\Browsers\\chrome.exe', 'saving the custom browser posts its path')

const urlInput = byClass('dpl-input-url')[0]
await act(async () => {
  urlInput.props.onChange({ target: { value: 'example.org' } })
  await flush()
})
await act(async () => {
  renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })
  await flush()
})
const addCall = calls.filter((call) => call.body?.action === 'add').at(-1)
assert(addCall?.body.url === 'example.org', 'the add form posts the typed address')
assert(byClass('dpl-row').length === 2, 'the added link appears in the list')

await act(async () => {
  renderer.unmount()
})
delete globalThis.window
globalThis.fetch = originalFetch
console.log('ALL CLIENT INTERACTIVE TESTS PASSED')
