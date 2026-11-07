/**
 * Project Links — browser half.
 *
 * Adds a "项目 / Projects" row to the left sidebar's global panel list and the
 * matching `main` panel that lists the links, probes them through the Host,
 * and lets the user add or remove entries.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-project-links',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace and the panel id shared by the sidebar row and the page. */
    const NS = 'project-links'
    const PANEL_ID = 'project-links'
    /** Browser-relative form of the Host's exact route. */
    const ROUTE = 'project-links'
    /** Background reachability refresh while the page stays mounted. */
    const CHECK_INTERVAL_MS = 45000

    const zh = {
      panel: '项目',
      title: '项目链接',
      subtitle: '点击任意项目直接打开；online / offline 由本机 Host 实时探测。',
      recheck: '重新检测',
      checking: '检测中…',
      add: '添加',
      namePlaceholder: '名称（可选）',
      urlPlaceholder: 'https://example.com',
      online: '在线',
      offline: '离线',
      unknown: '未检测',
      open: '打开',
      remove: '删除',
      empty: '还没有项目。在上方填写地址后点击「添加」。',
      loading: '正在加载…',
      loadFailed: '无法读取项目列表，请确认本机 DSH Host 正在运行。',
      retry: '重试',
      openWith: '打开方式',
      openWithTab: '新标签页（默认）',
      openWithCustom: '自定义浏览器…',
      customPlaceholder: '浏览器可执行文件路径，例如 C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      save: '保存',
      saved: '已保存',
      confirmRemove: '删除「{name}」？',
      'error.invalid-url': '请输入有效的 http/https 地址。',
      'error.duplicate': '这个链接已经在列表里了。',
      'error.not-found': '项目不存在，可能已被删除。',
      'error.invalid-json': '请求格式无效，请重试。',
      'error.too-large': '请求内容过大。',
      'error.unavailable': 'Host 没有响应，请稍后重试。',
      'error.browser-missing': '找不到该浏览器，已改在新标签页打开。',
      'error.invalid-browser': '不支持的浏览器选择。',
      'error.launch-failed': '无法启动该浏览器，已改在新标签页打开。',
      'error.unknown': '操作失败，请重试。',
    }

    const en = {
      panel: 'Projects',
      title: 'Project links',
      subtitle: 'Click any project to open it; online and offline are probed by the local Host.',
      recheck: 'Check again',
      checking: 'Checking…',
      add: 'Add',
      namePlaceholder: 'Name (optional)',
      urlPlaceholder: 'https://example.com',
      online: 'Online',
      offline: 'Offline',
      unknown: 'Not checked',
      open: 'Open',
      remove: 'Remove',
      empty: 'No projects yet. Enter an address above and press Add.',
      loading: 'Loading…',
      loadFailed: 'Could not read the project list. Make sure the local DSH Host is running.',
      retry: 'Retry',
      openWith: 'Open with',
      openWithTab: 'New tab (default)',
      openWithCustom: 'Custom browser…',
      customPlaceholder: 'Executable path, e.g. C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      save: 'Save',
      saved: 'Saved',
      confirmRemove: 'Remove “{name}”?',
      'error.invalid-url': 'Enter a valid http:// or https:// address.',
      'error.duplicate': 'That link is already in the list.',
      'error.not-found': 'That project no longer exists.',
      'error.invalid-json': 'The request was malformed. Try again.',
      'error.too-large': 'The request was too large.',
      'error.unavailable': 'The Host did not answer. Try again in a moment.',
      'error.browser-missing': 'That browser is missing; opened in a new tab instead.',
      'error.invalid-browser': 'That browser choice is not supported.',
      'error.launch-failed': 'Could not start that browser; opened in a new tab instead.',
      'error.unknown': 'That did not work. Try again.',
    }

    const CSS = [
      '.dpl-page{width:100%;height:100%;min-width:0;min-height:0;display:flex;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.55}',
      '.dpl-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}',
      '.dpl-content{max-width:880px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 56px}',
      '.dpl-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:28px;margin-bottom:20px}',
      '.dpl-title{margin:0;font-size:20px;font-weight:500;line-height:28px}',
      '.dpl-subtitle{margin:6px 0 0;font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.dpl-bar{display:flex;align-items:center;gap:8px}',
      '.dpl-button{height:32px;padding:0 14px;border-radius:16px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1;cursor:pointer}',
      '.dpl-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}',
      '.dpl-button:disabled{opacity:.55;cursor:default}',
      '.dpl-button-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff}',
      '.dpl-button-primary:hover:not(:disabled){opacity:.92;background:var(--dsw-alias-brand-primary)}',
      '.dpl-form{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 16px}',
      '.dpl-input{height:34px;min-width:0;padding:0 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:13px;outline:none}',
      '.dpl-input::placeholder{color:var(--dsw-alias-label-secondary)}',
      '.dpl-input:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.dpl-input-name{width:180px}',
      '.dpl-input-url{flex:1;min-width:200px}',
      '.dpl-note{margin:0 0 12px;font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.dpl-note-error{margin:0 0 12px;font-size:13px;color:var(--dsw-alias-state-error-primary)}',
      '.dpl-card{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}',
      '.dpl-row{display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;outline:none}',
      '.dpl-row+.dpl-row{border-top:1px solid var(--dsw-alias-border-l1)}',
      '.dpl-row:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dpl-row:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-alias-brand-primary)}',
      '.dpl-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}',
      '.dpl-dot.online{background:var(--dsw-alias-state-success-primary)}',
      '.dpl-dot.offline{background:var(--dsw-alias-state-error-primary)}',
      '.dpl-main{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}',
      '.dpl-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dpl-url{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.dpl-meta{display:flex;align-items:center;gap:8px;flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.dpl-status.online{color:var(--dsw-alias-state-success-primary)}',
      '.dpl-status.offline{color:var(--dsw-alias-state-error-primary)}',
      '.dpl-latency{color:var(--dsw-alias-label-secondary);opacity:.85}',
      '.dpl-open{flex:none;font-size:12px;color:var(--dsw-alias-brand-primary);text-decoration:none;white-space:nowrap}',
      '.dpl-open:hover{text-decoration:underline}',
      '.dpl-delete{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dpl-delete:hover{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-state-error-primary)}',
      '.dpl-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.dpl-hint{margin:10px 2px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dpl-openwith{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px;font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.dpl-openwith-label{white-space:nowrap}',
      '.dpl-select{height:30px;max-width:220px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}',
      '.dpl-select:focus{border-color:var(--dsw-alias-brand-primary)}',
      '.dpl-input-custom{flex:1;min-width:240px;height:30px}',
      '.dpl-saved{font-size:12px;color:var(--dsw-alias-state-success-primary)}',
      '@media (max-width:640px){.dpl-meta{display:none}.dpl-input-name{width:100%}}',
    ].join('')

    /** One failed request whose `code` is already a localized dictionary key. */
    class RequestError extends Error {
      constructor(code, status) {
        super(code)
        this.code = code
        this.status = status
      }
    }

    /** Read or write the Host route. */
    async function request(method, body) {
      let response
      try {
        response = await fetch(ROUTE, {
          method,
          cache: 'no-store',
          headers: body === undefined ? undefined : { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      } catch {
        throw new RequestError('unavailable', 0)
      }
      let data = null
      try {
        data = await response.json()
      } catch {
        data = null
      }
      if (!response.ok) throw new RequestError(typeof data?.error === 'string' ? data.error : 'unavailable', response.status)
      return data ?? { links: [], checks: {} }
    }

    /** Two chain links: the sidebar row's mark. */
    function chainMark(size, active) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block', opacity: active ? 1 : 0.92 },
        },
        h('path', { d: 'M10.2 13.8a4.6 4.6 0 0 0 6.5 0l2.1-2.1a4.6 4.6 0 0 0-6.5-6.5l-1.2 1.2' }),
        h('path', { d: 'M13.8 10.2a4.6 4.6 0 0 0-6.5 0l-2.1 2.1a4.6 4.6 0 0 0 6.5 6.5l1.2-1.2' }),
      )
    }

    /** Trash glyph for the row's remove control. */
    function trashMark() {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: 15,
          height: 15,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', { d: 'M4 7h16' }),
        h('path', { d: 'M10 11v6M14 11v6' }),
        h('path', { d: 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12' }),
        h('path', { d: 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' }),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'project-links: dictionaries')
        const t = ctx.locale.bind(NS)

        const messageFor = (error) => {
          const code = error instanceof RequestError ? error.code : 'unavailable'
          const key = `error.${code}`
          const text = t(key)
          return text === key ? t('error.unknown') : text
        }

        /** Sidebar row mark; the sidebar supplies size and the selected state. */
        function PanelIcon(props) {
          return chainMark(props?.size ?? 16, props?.active === true)
        }

        /** The `main` panel: list, add, remove, probe. */
        function ProjectsPage() {
          const [items, setItems] = React.useState([])
          const [checks, setChecks] = React.useState({})
          const [phase, setPhase] = React.useState('loading')
          const [loadError, setLoadError] = React.useState(null)
          const [busy, setBusy] = React.useState(false)
          const [checking, setChecking] = React.useState(false)
          const [name, setName] = React.useState('')
          const [url, setUrl] = React.useState('')
          const [formError, setFormError] = React.useState(null)
          const [actionError, setActionError] = React.useState(null)
          const [settings, setSettings] = React.useState({ browser: '', customPath: '' })
          const [browsers, setBrowsers] = React.useState([])
          const [openWithSupported, setOpenWithSupported] = React.useState(false)
          const [showCustom, setShowCustom] = React.useState(false)
          const [customDraft, setCustomDraft] = React.useState('')
          const [saved, setSaved] = React.useState(false)
          const mounted = React.useRef(true)
          const checkingRef = React.useRef(false)
          const savedTimer = React.useRef(null)

          const applyState = React.useCallback((value) => {
            if (!mounted.current || value === null || typeof value !== 'object') return
            if (Array.isArray(value.links)) setItems(value.links)
            if (value.checks !== null && typeof value.checks === 'object') setChecks(value.checks)
            if (Array.isArray(value.browsers)) setBrowsers(value.browsers.filter((row) => row !== null && typeof row?.id === 'string'))
            if (value.settings !== null && typeof value.settings === 'object') {
              setOpenWithSupported(true)
              setSettings({
                browser: typeof value.settings.browser === 'string' ? value.settings.browser : '',
                customPath: typeof value.settings.customPath === 'string' ? value.settings.customPath : '',
              })
            }
          }, [])

          const runCheck = React.useCallback(
            async (force) => {
              if (checkingRef.current) return
              checkingRef.current = true
              setChecking(true)
              try {
                applyState(await request('POST', { action: 'check', force: force === true }))
              } catch {
                // A failed refresh keeps the last observation.
              } finally {
                checkingRef.current = false
                if (mounted.current) setChecking(false)
              }
            },
            [applyState],
          )

          const load = React.useCallback(async () => {
            try {
              applyState(await request('GET'))
              if (mounted.current) {
                setPhase('ready')
                setLoadError(null)
              }
              void runCheck(false)
            } catch (error) {
              if (mounted.current) {
                setPhase('error')
                setLoadError(error instanceof RequestError ? error.code : 'unavailable')
              }
            }
          }, [applyState, runCheck])

          React.useEffect(() => {
            mounted.current = true
            void load()
            return () => {
              mounted.current = false
            }
          }, [load])

          React.useEffect(() => {
            const timer = setInterval(() => {
              void runCheck(false)
            }, CHECK_INTERVAL_MS)
            return () => clearInterval(timer)
          }, [runCheck])

          React.useEffect(() => {
            if (settings.browser === 'custom') {
              setShowCustom(true)
              setCustomDraft(settings.customPath)
            } else {
              setShowCustom(false)
            }
          }, [settings.browser, settings.customPath])

          React.useEffect(() => {
            return () => {
              if (savedTimer.current !== null) clearTimeout(savedTimer.current)
            }
          }, [])

          const submit = async (event) => {
            event.preventDefault()
            if (busy) return
            const trimmed = url.trim()
            if (trimmed === '') {
              setFormError(messageFor(new RequestError('invalid-url', 0)))
              return
            }
            setBusy(true)
            setFormError(null)
            setActionError(null)
            try {
              applyState(await request('POST', { action: 'add', name: name.trim(), url: trimmed }))
              setName('')
              setUrl('')
              void runCheck(false)
            } catch (error) {
              setFormError(messageFor(error))
            } finally {
              if (mounted.current) setBusy(false)
            }
          }

          const remove = async (link) => {
            if (!window.confirm(t('confirmRemove', { name: link.name }))) return
            setActionError(null)
            try {
              applyState(await request('POST', { action: 'remove', id: link.id }))
            } catch (error) {
              setActionError(messageFor(error))
            }
          }

          const open = async (link) => {
            if (settings.browser === '') {
              window.open(link.url, '_blank', 'noopener,noreferrer')
              return
            }
            try {
              await request('POST', { action: 'open', id: link.id })
            } catch (error) {
              setActionError(messageFor(error))
              window.open(link.url, '_blank', 'noopener,noreferrer')
            }
          }

          const saveSettings = async (browser, customPath) => {
            setActionError(null)
            try {
              applyState(await request('POST', { action: 'settings', browser, customPath }))
              setSaved(true)
              if (savedTimer.current !== null) clearTimeout(savedTimer.current)
              savedTimer.current = setTimeout(() => {
                if (mounted.current) setSaved(false)
              }, 2000)
            } catch (error) {
              setActionError(messageFor(error))
            }
          }

          const chooseBrowser = (event) => {
            const value = event.target.value
            if (value === 'custom') {
              setShowCustom(true)
              setCustomDraft(settings.customPath)
              return
            }
            setShowCustom(false)
            void saveSettings(value, settings.customPath)
          }

          const statusOf = (id) => checks[id]
          const statusLabel = (state) => (state === 'online' ? t('online') : state === 'offline' ? t('offline') : t('unknown'))

          const rows = items.map((link) => {
            const check = statusOf(link.id)
            const state = check?.state === 'online' || check?.state === 'offline' ? check.state : 'unknown'
            return h(
              'div',
              {
                key: link.id,
                className: 'dpl-row',
                role: 'link',
                tabIndex: 0,
                'aria-label': `${link.name} — ${link.url}`,
                onClick: () => open(link),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    open(link)
                  }
                },
              },
              h('span', { className: `dpl-dot ${state}`, 'aria-hidden': true }),
              h(
                'div',
                { className: 'dpl-main' },
                h('span', { className: 'dpl-name' }, link.name),
                h('span', { className: 'dpl-url' }, link.url),
              ),
              h(
                'div',
                { className: 'dpl-meta' },
                h('span', { className: `dpl-status ${state}` }, statusLabel(state), check?.status == null ? '' : ` ${String(check.status)}`),
                typeof check?.latencyMs === 'number' ? h('span', { className: 'dpl-latency' }, `${String(check.latencyMs)} ms`) : null,
              ),
              h(
                'a',
                {
                  className: 'dpl-open',
                  href: link.url,
                  target: '_blank',
                  rel: 'noreferrer noopener',
                  onClick: (event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void open(link)
                  },
                  onKeyDown: (event) => event.stopPropagation(),
                },
                t('open'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dpl-delete',
                  title: t('remove'),
                  'aria-label': t('remove'),
                  onClick: (event) => {
                    event.stopPropagation()
                    void remove(link)
                  },
                  onKeyDown: (event) => event.stopPropagation(),
                },
                trashMark(),
              ),
            )
          })

          let body
          if (phase === 'loading') body = h('div', { className: 'dpl-card' }, h('div', { className: 'dpl-empty' }, t('loading')))
          else if (phase === 'error') {
            body = h(
              'div',
              { className: 'dpl-card' },
              h(
                'div',
                { className: 'dpl-empty' },
                h('div', null, t('loadFailed')),
                h('div', { className: 'dpl-hint' }, messageFor(new RequestError(loadError ?? 'unavailable', 0))),
                h(
                  'div',
                  { className: 'dpl-bar', style: { justifyContent: 'center', marginTop: '14px' } },
                  h('button', { type: 'button', className: 'dpl-button', onClick: () => void load() }, t('retry')),
                ),
              ),
            )
          } else if (rows.length === 0) {
            body = h('div', { className: 'dpl-card' }, h('div', { className: 'dpl-empty' }, t('empty')))
          } else {
            body = h('div', { className: 'dpl-card' }, ...rows)
          }

          return h(
            'div',
            { className: 'dpl-page' },
            h('style', null, CSS),
            h(
              'div',
              { className: 'dpl-scroll' },
              h(
                'div',
                { className: 'dpl-content' },
                h(
                  'header',
                  { className: 'dpl-heading' },
                  h('div', null, h('h1', { className: 'dpl-title' }, t('title')), h('p', { className: 'dpl-subtitle' }, t('subtitle'))),
                  h(
                    'div',
                    { className: 'dpl-bar' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dpl-button',
                        disabled: checking || phase !== 'ready',
                        onClick: () => void runCheck(true),
                      },
                      checking ? t('checking') : t('recheck'),
                    ),
                  ),
                ),
                phase !== 'ready' || !openWithSupported
                  ? null
                  : h(
                      'div',
                      { className: 'dpl-openwith' },
                      h('label', { className: 'dpl-openwith-label', htmlFor: 'dpl-browser' }, t('openWith')),
                      h(
                        'select',
                        {
                          id: 'dpl-browser',
                          className: 'dpl-select',
                          value: settings.browser,
                          onChange: chooseBrowser,
                        },
                        h('option', { value: '' }, t('openWithTab')),
                        ...browsers.map((browser) => h('option', { key: browser.id, value: browser.id }, browser.label)),
                        h('option', { value: 'custom' }, t('openWithCustom')),
                      ),
                      showCustom
                        ? h('input', {
                            className: 'dpl-input dpl-input-custom',
                            value: customDraft,
                            placeholder: t('customPlaceholder'),
                            'aria-label': t('customPlaceholder'),
                            spellCheck: false,
                            onChange: (event) => setCustomDraft(event.target.value),
                          })
                        : null,
                      showCustom
                        ? h(
                            'button',
                            {
                              type: 'button',
                              className: 'dpl-button',
                              disabled: customDraft.trim() === '',
                              onClick: () => void saveSettings('custom', customDraft.trim()),
                            },
                            t('save'),
                          )
                        : null,
                      saved ? h('span', { className: 'dpl-saved' }, t('saved')) : null,
                    ),
                h(
                  'form',
                  { className: 'dpl-form', onSubmit: submit },
                  h('input', {
                    className: 'dpl-input dpl-input-name',
                    value: name,
                    placeholder: t('namePlaceholder'),
                    'aria-label': t('namePlaceholder'),
                    onChange: (event) => setName(event.target.value),
                  }),
                  h('input', {
                    className: 'dpl-input dpl-input-url',
                    value: url,
                    placeholder: t('urlPlaceholder'),
                    'aria-label': t('urlPlaceholder'),
                    inputMode: 'url',
                    autoComplete: 'off',
                    spellCheck: false,
                    onChange: (event) => setUrl(event.target.value),
                  }),
                  h('button', { type: 'submit', className: 'dpl-button dpl-button-primary', disabled: busy || url.trim() === '' }, t('add')),
                ),
                formError === null ? null : h('p', { className: 'dpl-note-error' }, formError),
                actionError === null ? null : h('p', { className: 'dpl-note-error' }, actionError),
                body,
              ),
            ),
          )
        }

        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS }, ProjectsPage),
        )
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 20,
              locale: NS,
              label: () => t('panel'),
            },
            PanelIcon,
          ),
        )
      },
    }
  },
})
