/**
 * Throwaway smoke test for the Project Links browser half. It fakes the module
 * loader, the Cordis client context, and the locale service, then renders the
 * panel shell with react-dom/server to catch factory, registration, and render
 * failures without a browser.
 *
 * Run: node D:\class-app\.dsh-plugin-tests\client-smoke.mjs
 */
import { createRequire } from 'node:module'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const React = require('react')

let loaded = null
globalThis.window = {
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

assert(loaded !== null, 'client module registers a loader factory')
assert(loaded.id === '@local/dsh-project-links', 'module id equals the package name')

const plugin = loaded.factory(require)
assert(Array.isArray(plugin.inject), 'plugin declares injected services')
assert(plugin.inject.includes('slots') && plugin.inject.includes('locale'), 'plugin injects slots and locale')
assert(typeof plugin.apply === 'function', 'plugin exposes apply')

const dictionaries = new Map()
let activeLocale = 'zh'
const registered = []

const slots = {
  inject(key, callback) {
    const dispose = callback()
    return dispose
  },
  register(options, component) {
    registered.push({ options, component })
    return () => {}
  },
}

const locale = {
  register(namespace, dicts) {
    dictionaries.set(namespace, dicts)
    return () => {}
  },
  bind(namespace) {
    return (key, values) => {
      const dicts = dictionaries.get(namespace) ?? {}
      const dict = dicts[activeLocale] ?? dicts.en ?? {}
      const template = typeof dict[key] === 'string' ? dict[key] : key
      if (values === undefined) return template
      return template.replace(/\{(\w+)\}/g, (match, name) => (values[name] === undefined ? match : String(values[name])))
    }
  },
}

const effects = []
const ctx = {
  effect: (callback, label) => {
    const dispose = callback()
    effects.push({ label, dispose })
    return dispose
  },
  locale,
  slots,
}

plugin.apply(ctx)

const main = registered.find((entry) => entry.options.name === 'main')
const panel = registered.find((entry) => entry.options.name === 'sidebar.panellist')

assert(main !== undefined, 'registers the main panel')
assert(main.options.key === 'project-links', 'main panel uses the sidebar id as its key')
assert(typeof main.component === 'function', 'main panel has a component')

assert(panel !== undefined, 'registers the sidebar row')
assert(panel.options.id === 'project-links', 'sidebar row id matches the main key')
assert(panel.options.order === 20, 'sidebar row sits after the shipped rows')
assert(panel.options.locale === 'project-links', 'sidebar row re-projects on locale change')
assert(panel.options.label() === '项目', 'sidebar row label is localized (zh)')
activeLocale = 'en'
assert(panel.options.label() === 'Projects', 'sidebar row label follows the locale (en)')
activeLocale = 'zh'

const markup = renderToStaticMarkup(React.createElement(main.component, {}))
assert(markup.includes('项目链接'), 'panel renders the localized title')
assert(markup.includes('项目') === false || markup.includes('项目链接'), 'panel renders without crashing')
assert(markup.includes('<style>'), 'panel ships its scoped styles')
assert(markup.includes('dpl-page'), 'panel uses its own class prefix')
assert(markup.includes('添加'), 'panel renders the add control')
assert(markup.includes('https://example.com'), 'panel shows the URL placeholder')

const icon = renderToStaticMarkup(React.createElement(panel.component, { size: 18, active: true }))
assert(icon.startsWith('<svg'), 'sidebar row renders an icon')
assert(icon.includes('width="18"'), 'sidebar row honors the requested icon size')

for (const { dispose } of effects) if (typeof dispose === 'function') dispose()
delete globalThis.window
console.log('ALL CLIENT SMOKE TESTS PASSED')
