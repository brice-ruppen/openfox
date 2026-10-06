// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { clearCache } from '../../lib/resourceCache'
import { DEFAULT_KEYBINDINGS, parseKeybindings, type KeyBinding } from '../../lib/keybindings'
import { settingResource, SETTINGS_KEYS } from '../../lib/resources'
import { KeybindingsTab } from '../settings/tabs/KeybindingsTab'
import { setLocale } from '@shared/i18n/index.js'

vi.mock('../../lib/ws', () => ({
  wsClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    subscribe: vi.fn(),
    onStatusChange: vi.fn(),
  },
}))

vi.mock('wouter', () => {
  const useLocation = vi.fn<() => [string, (to: string) => void]>(() => ['/', () => {}])
  return {
    Link: ({ children, href, className, onClick }: any) => {
      const [, navigate] = useLocation()
      return (
        <a
          href={href}
          className={className}
          onClick={(e) => {
            onClick?.(e)
            navigate(href)
          }}
        >
          {children}
        </a>
      )
    },
    useLocation,
    useSearch: () => '',
  }
})

const projectState = vi.hoisted(() => ({
  currentProject: null as { id: string; name: string; workdir: string } | null,
  projects: [] as Array<{ id: string; name: string; workdir: string }>,
}))

vi.mock('../../hooks/useCurrentProject', () => ({
  useCurrentProject: () => projectState.currentProject,
}))

vi.mock('../../hooks/useProjects', () => ({
  useProjects: () => ({ projects: projectState.projects, refresh: vi.fn(), loading: false }),
}))

interface MockStore {
  (selector?: (state: any) => any): any
  setState: (partial: Record<string, any>) => void
}

function mockStore(initial: Record<string, any>): MockStore {
  let state = { ...initial }
  const fn = vi.fn((selector?: (s: typeof state) => any) => {
    return selector ? selector(state) : state
  }) as unknown as MockStore
  fn.setState = (partial: Record<string, any>) => {
    state = { ...state, ...partial }
  }
  ;(fn as unknown as { getState: () => Record<string, any> }).getState = () => state
  return fn
}

vi.mock('../../stores/session', () => ({
  useSessionStore: mockStore({
    currentSession: null,
    sessions: [],
    messages: [],
    openSessionIds: [],
    focusedSessionId: null,
    agentMode: 'planner',
    planMode: false,
    status: 'idle',
    projectId: null,
    loadSession: vi.fn(),
    createSession: vi.fn(),
    listSessions: vi.fn(),
    deleteSession: vi.fn(),
    clearSession: vi.fn(),
    sendMessage: vi.fn(),
    stopGeneration: vi.fn(),
    continueGeneration: vi.fn(),
    launchWorkflow: vi.fn(),
    switchMode: vi.fn(),
    editCriteria: vi.fn(),
    compactContext: vi.fn(),
    setSessionProvider: vi.fn(),
    confirmPath: vi.fn(),
    queueAsap: vi.fn(),
    queueCompletion: vi.fn(),
    cancelQueued: vi.fn(),
    clearError: vi.fn(),
    handleServerMessage: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    logout: vi.fn(),
    connectionStatus: 'connected',
    unreadSessionIds: [],
    currentTodos: [],
    contextState: null,
    pendingPathConfirmation: null,
    queuedMessages: [],
    abortInProgress: false,
    error: null,
    pendingSessionCreate: false,
    openPane: vi.fn(async () => undefined),
    exitSplitView: vi.fn(),
  }),
}))

vi.mock('../../stores/project', () => ({
  useProjectStore: mockStore({
    currentProject: null,
    projects: [],
    loading: false,
    loadProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    clearProject: vi.fn(),
    listProjects: vi.fn(),
    handleServerMessage: vi.fn(),
    toggleStar: vi.fn(),
  }),
}))

vi.mock('../../stores/config', () => ({
  useConfigStore: mockStore({
    config: { theme: 'dark', llmProvider: 'ollama', model: 'test' },
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
  }),
}))

vi.mock('../../stores/terminal', () => ({
  useTerminalStore: mockStore({
    isOpen: false,
    sessions: [],
    workdir: null,
    setOpen: vi.fn(),
    toggleOpen: vi.fn(),
    setWorkdir: vi.fn(),
    executeCommand: vi.fn(),
    createSession: vi.fn(),
    killSession: vi.fn(),
    fetchSessions: vi.fn(async () => {}),
  }),
}))

vi.mock('../../hooks/useKeybindings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useKeybindings')>()
  return {
    ...actual,
    useKeybindings: vi.fn(actual.useKeybindings),
    useBinding: vi.fn(actual.useBinding),
  }
})

vi.mock('../../hooks/useWorkdir', () => ({
  useWorkdir: vi.fn(() => '/tmp'),
}))

vi.mock('../../lib/api', () => ({
  authFetch: vi.fn(async () => ({ ok: true, json: async () => ({}) })),
}))

vi.mock('../../hooks/useAgents', () => ({
  useAgents: vi.fn(() => ({ agents: [], refresh: vi.fn() })),
}))

vi.mock('../../stores/tasks', () => ({
  useTasksStore: mockStore({
    lastError: null,
    lastAutoLaunch: null,
    clearAutoLaunch: vi.fn(),
  }),
}))

const mountedRoots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }> = []

function render(ui: React.ReactElement): HTMLElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push({ root, container })
  act(() => {
    root.render(ui)
  })
  return container
}

afterEach(() => {
  for (const { root } of mountedRoots.splice(0)) {
    act(() => {
      root.unmount()
    })
  }
})

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    clearCache()
  })

  it('renders the OpenFox logo link', async () => {
    const { Header } = await import('./Header')
    const container = render(<Header />)
    expect(container.textContent).toContain('OpenFox')
  })

  it('renders settings button', async () => {
    const { Header } = await import('./Header')
    const container = render(<Header />)
    const btn = container.querySelector('[title="Settings"]')
    expect(btn).toBeTruthy()
  })

  it('renders logout button', async () => {
    const { Header } = await import('./Header')
    const container = render(<Header />)
    const btn = container.querySelector('[title="Logout"]')
    expect(btn).toBeTruthy()
  })

  it('shows project name when project exists', async () => {
    projectState.currentProject = { id: 'p1', name: 'My Project', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'My Project', workdir: '/tmp' }]

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    expect(container.textContent).toContain('My Project')
  })

  it('hides the leading separator before the project dropdown on mobile', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    const separators = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent === '/' && s.className.includes('text-text-muted'),
    )
    expect(separators.length).toBe(2)
    // The leading separator (between OpenFox and the project) is desktop-only;
    // the one between project and session shows at all breakpoints.
    expect(separators[0]!.className).toContain('hidden')
    expect(separators[1]!.className).not.toContain('hidden')
  })

  it('wraps the project name in a truncating span so the header cannot overflow', async () => {
    projectState.currentProject = { id: 'p1', name: 'My Project', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'My Project', workdir: '/tmp' }]

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    const trigger = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('My Project'))
    expect(trigger).toBeTruthy()
    const label = trigger!.querySelector('span.truncate')
    expect(label).toBeTruthy()
    expect(label!.textContent).toContain('My Project')
  })

  it('wraps the session label in a truncating span so the header cannot overflow', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]

    const { useSessionStore } = await import('../../stores/session')
    ;(useSessionStore as unknown as MockStore).setState({
      currentSession: { id: 's1', metadata: { title: 'A very long session title' } },
      sessions: [
        { id: 's1', projectId: 'p1', title: 'A very long session title', updatedAt: new Date().toISOString() },
      ],
    })

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/s/s1', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    const btn = container.querySelector('[data-testid="header-session-dropdown"]')
    expect(btn).toBeTruthy()
    const label = btn!.querySelector('span.truncate')
    expect(label).toBeTruthy()
    expect(label!.textContent).toContain('A very long session title')
  })

  it('keeps the project dropdown trigger compact: sized chevron and a label truncation floor', async () => {
    projectState.currentProject = { id: 'p1', name: 'My Project', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'My Project', workdir: '/tmp' }]

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    const trigger = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('My Project'))
    expect(trigger).toBeTruthy()
    const chevron = trigger!.querySelector('svg')
    expect(chevron?.getAttribute('class')).toContain('w-3')
    expect(chevron?.getAttribute('class')).toContain('flex-shrink-0')
    const label = trigger!.querySelector('span.truncate')
    expect(label?.getAttribute('class')).toContain('max-w-[')
  })

  it('keeps the separator stable with a non-shrinking project dropdown wrapper', async () => {
    projectState.currentProject = { id: 'p1', name: 'My Project', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'My Project', workdir: '/tmp' }]

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    const trigger = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('My Project'))
    expect(trigger).toBeTruthy()
    // button -> trigger wrapper -> dropdown root -> the non-shrinking flex wrapper
    const wrapper = trigger!.parentElement!.parentElement!.parentElement!
    expect(wrapper.className).toContain('flex-shrink-0')
  })

  it('keeps the session dropdown trigger compact: sized chevron and a label truncation floor', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]

    const { useSessionStore } = await import('../../stores/session')
    ;(useSessionStore as unknown as MockStore).setState({
      currentSession: { id: 's1', metadata: { title: 'A very long session title' } },
      sessions: [
        { id: 's1', projectId: 'p1', title: 'A very long session title', updatedAt: new Date().toISOString() },
      ],
    })

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/s/s1', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    const btn = container.querySelector('[data-testid="header-session-dropdown"]')
    expect(btn).toBeTruthy()
    const chevron = btn!.querySelector('svg')
    expect(chevron?.getAttribute('class')).toContain('w-3')
    expect(chevron?.getAttribute('class')).toContain('flex-shrink-0')
    const label = btn!.querySelector('span.truncate')
    expect(label?.getAttribute('class')).toContain('min-w-[')
    expect(btn!.getAttribute('class')).toContain('w-full')
  })

  it('offers a Home footer item in the project dropdown that navigates to the homepage', async () => {
    projectState.currentProject = { id: 'p1', name: 'My Project', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'My Project', workdir: '/tmp' }]

    const { useLocation } = await import('wouter')
    const setLocation = vi.fn()
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', setLocation])

    const { Header } = await import('./Header')
    const container = render(<Header />)

    const projectTrigger = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('My Project'),
    )
    expect(projectTrigger).toBeTruthy()
    act(() => {
      projectTrigger!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    const menu = document.querySelector('[data-testid="session-dropdown-menu"]')
    expect(menu).toBeTruthy()
    const homeLink = Array.from(menu!.querySelectorAll('a')).find((a) => a.textContent?.includes('Home'))
    expect(homeLink).toBeTruthy()
    expect(homeLink!.getAttribute('href')).toBe('/')

    act(() => {
      homeLink!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    expect(setLocation).toHaveBeenCalledWith('/')
  })

  it('shows terminal toggle on project page', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    const btn = container.querySelector('[title^="Toggle terminal"]')
    expect(btn).toBeTruthy()
  })

  it('shows menu button when onMenuClick provided and on session page', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/s/s1', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header onMenuClick={vi.fn()} />)
    const btn = container.querySelector('[title^="Toggle session list"]')
    expect(btn).toBeTruthy()
  })

  it('hides menu button when not on session page', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header onMenuClick={vi.fn()} />)
    const btn = container.querySelector('[title^="Toggle session list"]')
    expect(btn).toBeNull()
  })

  it('truncates long session name in header dropdown trigger', async () => {
    projectState.currentProject = { id: 'p1', name: 'Test Project', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'Test Project', workdir: '/tmp' }]

    const { useSessionStore } = await import('../../stores/session')
    const longTitle = 'a'.repeat(100)
    ;(useSessionStore as unknown as MockStore).setState({
      currentSession: { id: 's1', metadata: { title: longTitle } },
      sessions: [{ id: 's1', projectId: 'p1', title: longTitle, updatedAt: new Date().toISOString() }],
    })

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/s/s1', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    const btn = container.querySelector('[data-testid="header-session-dropdown"]')
    expect(btn).toBeTruthy()
    // Button text should be truncated (50 chars + '...')
    expect(btn!.textContent).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa...')
    // Title attribute should still contain the full name
    expect(btn!.getAttribute('title')).toBe(longTitle)
  })

  it('shows only the running task count in the green badge', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]

    const { summariesResource } = await import('../../lib/resources')
    summariesResource.write(
      {
        counts: {
          open: 5,
          todo: 3,
          inProgress: 2,
          running: 2,
          queued: 0,
          done: 0,
        },
      },
      'p1',
    )

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    const badge = container.querySelector('[aria-label="Open project tasks"] span')
    expect(badge).toBeTruthy()
    expect(badge!.textContent).toBe('2')
    expect(badge!.className).toContain('bg-accent-success')
  })

  it('hides the task badge when no tasks are running', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]

    const { summariesResource } = await import('../../lib/resources')
    summariesResource.write(
      {
        counts: {
          open: 5,
          todo: 3,
          inProgress: 2,
          running: 0,
          queued: 2,
          done: 0,
        },
      },
      'p1',
    )

    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    expect(container.querySelector('[aria-label="Open project tasks"] span')).toBeNull()
  })

  it('shows the control panel toggle on the split-view route', async () => {
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/split-view', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header onMenuClick={vi.fn()} />)
    expect(container.querySelector('[aria-label="Toggle split view control panel"]')).toBeTruthy()
  })

  it('shows the split indicator and exits back home from the split route', async () => {
    const { useSessionStore } = await import('../../stores/session')
    ;(useSessionStore as unknown as MockStore).setState({ openSessionIds: ['s1', 's2'] })

    const { useLocation } = await import('wouter')
    const setLocation = vi.fn()
    vi.mocked(useLocation).mockReturnValue(['/split-view', setLocation])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    expect(container.querySelector('[data-testid="split-indicator"]')?.textContent).toContain('2')

    const exitBtn = container.querySelector('[aria-label="Exit split view"]')
    expect(exitBtn).toBeTruthy()
    act(() => {
      exitBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(setLocation).toHaveBeenCalledWith('/')
    const { exitSplitView } = useSessionStore.getState()
    expect(exitSplitView).toHaveBeenCalledTimes(1)
  })
})

describe('Header split-view shortcut', () => {
  const binding: KeyBinding = { type: 'chord', key: 'v', modifiers: ['ctrl', 'shift'] }

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    clearCache()
    setLocale('en')
    settingResource.write(JSON.stringify({ openSplitView: binding }), SETTINGS_KEYS.KEYBINDINGS)
  })

  function pressShortcut(extra: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', {
      key: 'v',
      code: 'KeyV',
      ctrlKey: true,
      shiftKey: true,
      cancelable: true,
      bubbles: true,
      ...extra,
    })
    act(() => {
      window.dispatchEvent(event)
    })
    return event
  }

  it.each(['/', '/p/p1/', '/p/p1/s/s1'])('opens the existing split route from %s', async (location) => {
    const { useLocation } = await import('wouter')
    const navigate = vi.fn()
    vi.mocked(useLocation).mockReturnValue([location, navigate])
    const { Header } = await import('./Header')
    render(<Header />)

    expect(pressShortcut().defaultPrevented).toBe(true)
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/split-view')
    const { useSessionStore } = await import('../../stores/session')
    expect(useSessionStore.getState().openPane).not.toHaveBeenCalled()
    expect(useSessionStore.getState().createSession).not.toHaveBeenCalled()
    expect(useSessionStore.getState().exitSplitView).not.toHaveBeenCalled()
  })

  it('does not navigate or alter panes when already in split view', async () => {
    const { useLocation } = await import('wouter')
    const navigate = vi.fn()
    vi.mocked(useLocation).mockReturnValue(['/split-view', navigate])
    const { useSessionStore } = await import('../../stores/session')
    ;(useSessionStore as unknown as MockStore).setState({ openSessionIds: ['s2', 's1'], focusedSessionId: 's1' })
    const { Header } = await import('./Header')
    render(<Header />)
    pressShortcut()
    expect(navigate).not.toHaveBeenCalled()
    expect(useSessionStore.getState().openSessionIds).toEqual(['s2', 's1'])
    expect(useSessionStore.getState().focusedSessionId).toBe('s1')
  })

  it('ignores mismatched modifiers and updates immediately when the saved binding changes', async () => {
    const { useLocation } = await import('wouter')
    const navigate = vi.fn()
    vi.mocked(useLocation).mockReturnValue(['/', navigate])
    const { Header } = await import('./Header')
    render(<Header />)
    expect(pressShortcut({ shiftKey: false }).defaultPrevented).toBe(false)
    expect(navigate).not.toHaveBeenCalled()

    await act(async () => {
      settingResource.write(JSON.stringify({ openSplitView: null }), SETTINGS_KEYS.KEYBINDINGS)
    })
    expect(pressShortcut().defaultPrevented).toBe(false)
    expect(navigate).not.toHaveBeenCalled()

    await act(async () => {
      settingResource.write(
        JSON.stringify({ openSplitView: { type: 'chord', key: 'v', modifiers: ['meta'] } }),
        SETTINGS_KEYS.KEYBINDINGS,
      )
    })
    pressShortcut()
    expect(navigate).not.toHaveBeenCalled()
    pressShortcut({ ctrlKey: false, shiftKey: false, metaKey: true })
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/split-view')
  })

  it('supports configured double presses without navigating while Settings is open', async () => {
    settingResource.write(
      JSON.stringify({ openSplitView: { type: 'double-press', key: 'Alt', threshold: 300 } }),
      SETTINGS_KEYS.KEYBINDINGS,
    )
    const { useLocation } = await import('wouter')
    const navigate = vi.fn()
    vi.mocked(useLocation).mockReturnValue(['/', navigate])
    const { Header } = await import('./Header')
    render(<Header />)
    const settings = document.createElement('div')
    settings.setAttribute('data-global-settings', '')
    document.body.appendChild(settings)
    const press = () => pressShortcut({ key: 'Alt', ctrlKey: false, shiftKey: false, altKey: true })
    press()
    press()
    expect(navigate).not.toHaveBeenCalled()
    settings.remove()
    press()
    press()
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/split-view')
  })

  it('records and persists in Settings without navigation, then activates after closing and remounting', async () => {
    const { authFetch } = await import('../../lib/api')
    let saved = JSON.stringify({ terminalToggle: null })
    vi.mocked(authFetch).mockImplementation(async (_url, options) => {
      if (options?.method === 'PUT') {
        saved = (JSON.parse(String(options.body)) as { value: string }).value
      }
      return { ok: true, json: async () => ({ value: saved }) } as Response
    })
    settingResource.write(saved, SETTINGS_KEYS.KEYBINDINGS)
    const { useLocation } = await import('wouter')
    const navigate = vi.fn()
    vi.mocked(useLocation).mockReturnValue(['/', navigate])
    const { Header } = await import('./Header')
    render(<Header />)
    const settings = render(<KeybindingsTab />)
    settings.setAttribute('data-global-settings', '')
    const row = Array.from(settings.querySelectorAll('span')).find(
      (s) => s.textContent === 'Open split view',
    )?.parentElement
    expect(row).toBeTruthy()
    act(() => {
      row!.querySelector('button')!.click()
    })
    await act(async () => {
      pressShortcut()
    })
    expect(parseKeybindings(saved).openSplitView).toEqual(binding)
    expect(parseKeybindings(saved).terminalToggle).toBeNull()
    pressShortcut()
    expect(navigate).not.toHaveBeenCalled()
    const settingsRoot = mountedRoots.pop()!
    act(() => {
      settingsRoot.root.unmount()
    })
    settings.remove()
    pressShortcut()
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/split-view')

    const headerRoot = mountedRoots.pop()!
    act(() => {
      headerRoot.root.unmount()
    })
    headerRoot.container.remove()
    clearCache()
    navigate.mockClear()
    await act(async () => {
      render(<Header />)
    })
    pressShortcut()
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/split-view')
  })

  it('does not intercept the unassigned default shortcut', async () => {
    settingResource.write(JSON.stringify(DEFAULT_KEYBINDINGS), SETTINGS_KEYS.KEYBINDINGS)
    const { useLocation } = await import('wouter')
    const navigate = vi.fn()
    vi.mocked(useLocation).mockReturnValue(['/', navigate])
    const { Header } = await import('./Header')
    render(<Header />)
    expect(pressShortcut().defaultPrevented).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('Header split-view session search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    clearCache()
    setLocale('en')
    settingResource.write(JSON.stringify(DEFAULT_KEYBINDINGS), SETTINGS_KEYS.KEYBINDINGS)
  })

  function pressSearch(extra: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
      ...extra,
    })
    act(() => {
      window.dispatchEvent(event)
    })
    return event
  }

  it('toggles the split control panel with Search Sessions without navigating or changing panes', async () => {
    const { useLocation } = await import('wouter')
    const navigate = vi.fn()
    vi.mocked(useLocation).mockReturnValue(['/split-view', navigate])
    const { useSessionStore } = await import('../../stores/session')
    ;(useSessionStore as unknown as MockStore).setState({ openSessionIds: ['s2', 's1'], focusedSessionId: 's1' })
    const toggle = vi.fn()
    const { Header } = await import('./Header')
    render(<Header onMenuClick={toggle} />)
    expect(pressSearch().defaultPrevented).toBe(true)
    pressSearch()
    expect(toggle).toHaveBeenCalledTimes(2)
    expect(navigate).not.toHaveBeenCalled()
    expect(useSessionStore.getState().openSessionIds).toEqual(['s2', 's1'])
    expect(useSessionStore.getState().focusedSessionId).toBe('s1')
    expect(document.querySelector('[data-testid="session-dropdown-menu"]')).toBeNull()
  })

  it.each(['/', '/p/p1/', '/p/p1/s/s1'])(
    'leaves the existing non-split search handler alone on %s',
    async (location) => {
      const { useLocation } = await import('wouter')
      vi.mocked(useLocation).mockReturnValue([location, vi.fn()])
      const toggle = vi.fn()
      const { Header } = await import('./Header')
      render(<Header onMenuClick={toggle} />)
      expect(pressSearch().defaultPrevented).toBe(false)
      expect(toggle).not.toHaveBeenCalled()
    },
  )

  it('honors live custom and disabled Search Sessions bindings', async () => {
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/split-view', vi.fn()])
    const toggle = vi.fn()
    const { Header } = await import('./Header')
    render(<Header onMenuClick={toggle} />)
    await act(async () => {
      settingResource.write(
        JSON.stringify({ sessionSearch: { type: 'chord', key: 'f', modifiers: ['meta'] } }),
        SETTINGS_KEYS.KEYBINDINGS,
      )
    })
    expect(pressSearch().defaultPrevented).toBe(false)
    pressSearch({ key: 'f', code: 'KeyF', ctrlKey: false, metaKey: true })
    expect(toggle).toHaveBeenCalledTimes(1)
    await act(async () => {
      settingResource.write(JSON.stringify({ sessionSearch: null }), SETTINGS_KEYS.KEYBINDINGS)
    })
    expect(pressSearch({ key: 'f', code: 'KeyF', ctrlKey: false, metaKey: true }).defaultPrevented).toBe(false)
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('does not toggle the control panel while Settings is open', async () => {
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/split-view', vi.fn()])
    const toggle = vi.fn()
    const { Header } = await import('./Header')
    render(<Header onMenuClick={toggle} />)
    const settings = document.createElement('div')
    settings.setAttribute('data-global-settings', '')
    document.body.appendChild(settings)
    pressSearch()
    expect(toggle).not.toHaveBeenCalled()
    settings.remove()
    pressSearch()
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('supports a double-press Search Sessions binding', async () => {
    settingResource.write(
      JSON.stringify({ sessionSearch: { type: 'double-press', key: 'Alt', threshold: 300 } }),
      SETTINGS_KEYS.KEYBINDINGS,
    )
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/split-view', vi.fn()])
    const toggle = vi.fn()
    const { Header } = await import('./Header')
    render(<Header onMenuClick={toggle} />)
    pressSearch({ key: 'Alt', ctrlKey: false, altKey: true })
    expect(toggle).not.toHaveBeenCalled()
    pressSearch({ key: 'Alt', ctrlKey: false, altKey: true })
    expect(toggle).toHaveBeenCalledTimes(1)
  })
})

describe('Keybindings split-view settings', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    clearCache()
    setLocale('en')
    settingResource.write(JSON.stringify({ terminalToggle: null }), SETTINGS_KEYS.KEYBINDINGS)
    const { authFetch } = await import('../../lib/api')
    vi.mocked(authFetch).mockImplementation(async (_url, options) => {
      const { value } = JSON.parse(String(options?.body)) as { value: string }
      return { ok: true, json: async () => ({ value }) } as Response
    })
  })

  function splitRow(container: HTMLElement, label = 'Open split view') {
    const row = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === label)?.parentElement
    if (!row) throw new Error('Split-view keybinding row not found')
    return row
  }

  async function click(button: Element | null) {
    expect(button).toBeTruthy()
    await act(async () => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }

  it('renders an unassigned action in English and French', () => {
    const container = render(<KeybindingsTab />)
    expect(splitRow(container).querySelector('button')?.textContent).toBe('None')
    setLocale('fr')
    const frenchContainer = render(<KeybindingsTab />)
    expect(splitRow(frenchContainer, 'Ouvrir la vue divisée').querySelector('button')?.textContent).toBe('Aucun')
    setLocale('en')
  })

  it('records a chord, clears it, and resets it individually without changing other actions', async () => {
    const container = render(<KeybindingsTab />)
    const record = async () => {
      await click(splitRow(container).querySelector('button'))
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', ctrlKey: true, shiftKey: true, bubbles: true }),
        )
      })
    }
    await record()
    expect(splitRow(container).querySelector('button')?.textContent).toBe('Ctrl+Shift+V')
    await click(splitRow(container).querySelector('[aria-label="Remove shortcut for Open split view"]'))
    expect(splitRow(container).querySelector('button')?.textContent).toBe('None')
    await record()
    await click(splitRow(container).querySelector('[aria-label="Reset Open split view to default"]'))
    expect(splitRow(container).querySelector('button')?.textContent).toBe('None')
    const { authFetch } = await import('../../lib/api')
    const lastOptions = vi.mocked(authFetch).mock.calls.at(-1)?.[1]
    const { value } = JSON.parse(String(lastOptions?.body)) as { value: string }
    expect(parseKeybindings(value).openSplitView).toBeNull()
    expect(parseKeybindings(value).terminalToggle).toBeNull()
  })

  it('cancels recording with Escape and supports double-press recording and reset-all', async () => {
    const container = render(<KeybindingsTab />)
    await click(splitRow(container).querySelector('button'))
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    const { authFetch } = await import('../../lib/api')
    expect(authFetch).not.toHaveBeenCalled()
    expect(splitRow(container).querySelector('button')?.textContent).toBe('None')
    await click(splitRow(container).querySelector('button'))
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }))
    })
    expect(splitRow(container).querySelector('button')?.textContent).toBe('Double Alt')
    await click(
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Reset to defaults') ?? null,
    )
    expect(splitRow(container).querySelector('button')?.textContent).toBe('None')
    const lastOptions = vi.mocked(authFetch).mock.calls.at(-1)?.[1]
    const { value } = JSON.parse(String(lastOptions?.body)) as { value: string }
    expect(JSON.parse(value)).toEqual(DEFAULT_KEYBINDINGS)
  })
})

describe('Header mobile menu', () => {
  beforeEach(async () => {
    const { useTerminalStore } = await import('../../stores/terminal')
    useTerminalStore.setState({ isOpen: false })
    const storage = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, String(v)),
        removeItem: (k: string) => storage.delete(k),
        clear: () => storage.clear(),
      },
      configurable: true,
      writable: true,
    })
  })

  function openMobileMenu(container: HTMLElement) {
    const trigger = container.querySelector('[aria-label="Open header menu"]')
    if (!trigger) throw new Error('Mobile menu trigger not found')
    act(() => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
  }

  function clickMenuItem(label: string) {
    const menu = document.querySelector('[data-testid="session-dropdown-menu"]')
    const button = Array.from(menu?.querySelectorAll('button') ?? []).find((b) => b.textContent?.includes(label))
    if (!button) throw new Error(`Menu item "${label}" not found`)
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
  }

  it('renders a single chevron trigger on mobile', async () => {
    const { Header } = await import('./Header')
    const container = render(<Header />)
    expect(container.querySelector('[aria-label="Open header menu"]')).toBeTruthy()
  })

  it('lists all actions on a project session page', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/s/s1', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    const menu = document.querySelector('[data-testid="session-dropdown-menu"]')
    expect(menu).toBeTruthy()
    expect(menu!.textContent).toContain('Tasks')
    expect(menu!.textContent).toContain('Terminal')
    expect(menu!.textContent).toContain('Open Folder')
    expect(menu!.textContent).toContain('Settings')
    expect(menu!.textContent).toContain('Logout')
    expect(menu!.textContent).toContain('Fullscreen')
  })

  it('lists notifications and plugins in the mobile menu', async () => {
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    const menu = document.querySelector('[data-testid="session-dropdown-menu"]')
    expect(menu!.textContent).toContain('Notifications')
    expect(menu!.textContent).toContain('Plugins')
  })

  it('drills into the notifications submenu and back', async () => {
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    clickMenuItem('Notifications')
    const menu = document.querySelector('[data-testid="session-dropdown-menu"]')
    expect(menu!.textContent).toContain('No notifications yet')
    expect(menu!.textContent).not.toContain('Fullscreen')

    clickMenuItem('Back')
    expect(menu!.textContent).toContain('Fullscreen')
    expect(menu!.textContent).not.toContain('No notifications yet')
  })

  it('drills into the plugins submenu', async () => {
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    clickMenuItem('Plugins')
    const menu = document.querySelector('[data-testid="session-dropdown-menu"]')
    expect(menu!.textContent).toContain('No plugins installed')
  })

  it('shows only global actions outside a project page', async () => {
    const { useProjectStore } = await import('../../stores/project')
    ;(useProjectStore as unknown as MockStore).setState({ currentProject: null, projects: [] })
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    const menu = document.querySelector('[data-testid="session-dropdown-menu"]')
    expect(menu).toBeTruthy()
    expect(menu!.textContent).toContain('Settings')
    expect(menu!.textContent).toContain('Logout')
    expect(menu!.textContent).toContain('Fullscreen')
    expect(menu!.textContent).not.toContain('Tasks')
    expect(menu!.textContent).not.toContain('Terminal')
    expect(menu!.textContent).not.toContain('Open Folder')
  })

  it('toggles the terminal from the menu', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    clickMenuItem('Terminal')
    const { useTerminalStore } = await import('../../stores/terminal')
    const { setOpen } = useTerminalStore.getState()
    expect(setOpen).toHaveBeenCalledWith(true)
  })

  it('highlights the terminal item when the terminal is open', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]
    const { useTerminalStore } = await import('../../stores/terminal')
    useTerminalStore.setState({ isOpen: true })
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    const menu = document.querySelector('[data-testid="session-dropdown-menu"]')
    const terminalItem = Array.from(menu!.querySelectorAll('button')).find((b) => b.textContent?.includes('Terminal'))
    expect(terminalItem?.querySelector('svg')?.getAttribute('class')).toContain('text-accent-primary')
  })

  it('opens settings from the menu', async () => {
    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    clickMenuItem('Settings')
    expect(document.querySelector('[data-global-settings]')).toBeTruthy()
  })

  it('opens tasks from the menu', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    clickMenuItem('Tasks')
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog!.textContent).toContain('Tasks')
  })

  it('logs out from the menu', async () => {
    const { useLocation } = await import('wouter')
    const setLocation = vi.fn()
    vi.mocked(useLocation).mockReturnValue(['/', setLocation])
    const { useSessionStore } = await import('../../stores/session')
    const logoutSpy = (useSessionStore as unknown as { getState: () => Record<string, any> }).getState().logout

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    clickMenuItem('Logout')
    expect(logoutSpy).toHaveBeenCalled()
    expect(setLocation).toHaveBeenCalledWith('/')
  })

  it('logs out from the desktop button', async () => {
    const { useLocation } = await import('wouter')
    const setLocation = vi.fn()
    vi.mocked(useLocation).mockReturnValue(['/', setLocation])
    const { useSessionStore } = await import('../../stores/session')
    const logoutSpy = (useSessionStore as unknown as { getState: () => Record<string, any> }).getState().logout

    const { Header } = await import('./Header')
    const container = render(<Header />)
    const logoutButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.title === 'Logout',
    ) as HTMLButtonElement
    expect(logoutButton).toBeTruthy()
    act(() => {
      logoutButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    expect(logoutSpy).toHaveBeenCalled()
    expect(setLocation).toHaveBeenCalledWith('/')
  })

  it('toggles fullscreen from the menu', async () => {
    const requestFullscreen = vi.fn()
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true })

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    clickMenuItem('Fullscreen')
    expect(requestFullscreen).toHaveBeenCalled()
  })

  it('shows the running task count badge on the Tasks item', async () => {
    projectState.currentProject = { id: 'p1', name: 'P', workdir: '/tmp' }
    projectState.projects = [{ id: 'p1', name: 'P', workdir: '/tmp' }]
    const { summariesResource } = await import('../../lib/resources')
    summariesResource.write({ counts: { open: 0, todo: 0, inProgress: 0, running: 3, queued: 0, done: 0 } }, 'p1')
    const { useLocation } = await import('wouter')
    vi.mocked(useLocation).mockReturnValue(['/p/p1/', vi.fn()])

    const { Header } = await import('./Header')
    const container = render(<Header />)
    openMobileMenu(container)
    const menu = document.querySelector('[data-testid="session-dropdown-menu"]')
    const tasksItem = Array.from(menu!.querySelectorAll('button')).find((b) => b.textContent?.includes('Tasks'))
    expect(tasksItem?.textContent).toContain('3')
  })

  it('opens GlobalSettingsModal on OPEN_SETTINGS_EVENT with target tab', async () => {
    const { Header } = await import('./Header')
    const { OPEN_SETTINGS_EVENT } = await import('../settings/GlobalSettingsModal')
    render(<Header />)

    act(() => {
      window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: { tab: 'plugins' } }))
    })

    const settingsModal = document.querySelector('[data-global-settings]')
    expect(settingsModal).toBeTruthy()
  })
})
