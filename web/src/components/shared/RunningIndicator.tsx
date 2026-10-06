import { useEffect, useState } from 'react'
import type { PendingQuestion, PendingPathConfirmation } from '../../stores/session'
import type { Message } from '@shared/types.js'
import { useSessionScope, useScopedPaneState } from '../../stores/session/session-scope'
import { projectFromSessionStore, statusLabel, type SessionStatusState } from '../../lib/session-status'
import { formatTimeSince } from '../../lib/format-date'
import { useT } from '../../hooks/useT'

// Stable references for zustand selectors (a fresh [] each render would loop).
const EMPTY_MESSAGES: Message[] = []
const EMPTY_QUESTIONS: PendingQuestion[] = []
const EMPTY_CONFIRMATIONS: PendingPathConfirmation[] = []

/**
 * Session status indicator shown at the bottom of the chat.
 * Reuses the existing position. Displays the factually-derived state
 * (running / waiting / completed / blocked) when one is present in the
 * existing client-side session data, otherwise renders nothing.
 *
 * The component is strictly read-only: no click handler, no actions, no
 * new sync mechanism. All inputs come from useSessionStore, which is
 * already populated by the existing session-load flow.
 */
export function RunningIndicator() {
  const t = useT()
  // Scope every read to this pane's session: in split view the flat store
  // fields mirror the focused pane, so reading them directly would leak the
  // focused pane's state (e.g. "Running") into every sibling pane.
  const sessionId = useSessionScope()
  const aborting = useScopedPaneState(
    sessionId,
    (pane) => pane.abortInProgress,
    (state) => state.abortInProgress,
    false,
  )
  const currentSession = useScopedPaneState(
    sessionId,
    (pane) => pane.session ?? null,
    (state) => state.currentSession,
    null,
  )
  const messages = useScopedPaneState(
    sessionId,
    (pane) => pane.messages,
    (state) => state.messages,
    EMPTY_MESSAGES,
  )
  const pendingQuestions = useScopedPaneState(
    sessionId,
    (pane) => pane.pendingQuestions,
    (state) => state.pendingQuestions,
    EMPTY_QUESTIONS,
  )
  const pendingPathConfirmations = useScopedPaneState(
    sessionId,
    (pane) => pane.pendingPathConfirmations,
    (state) => state.pendingPathConfirmations,
    EMPTY_CONFIRMATIONS,
  )
  const activeWorkflowExecution = useScopedPaneState(
    sessionId,
    (pane) => pane.activeWorkflowExecution ?? null,
    (state) => state.activeWorkflowExecution,
    null,
  )

  const view = projectFromSessionStore({
    currentSession,
    messages,
    pendingQuestions,
    pendingPathConfirmations,
    activeWorkflowExecution,
  })

  const state: SessionStatusState = view.state

  const lastPromptAt = view.lastPromptAt
  const [now, setNow] = useState(() => Date.now())

  const timerActive = lastPromptAt !== null && (state === 'running' || state === 'waiting' || state === 'pausing')

  useEffect(() => {
    if (!timerActive) return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [timerActive])

  if (state === null) return null

  const statusLabels: Record<string, string> = {
    Running: t({ en: 'Running', fr: 'En cours' }),
    'Pausing…': t({ en: 'Pausing…', fr: 'Mise en pause…' }),
    Paused: t({ en: 'Paused', fr: 'En pause' }),
    'Waiting for input': t({ en: 'Waiting for input', fr: 'En attente de votre intervention' }),
    Completed: t({ en: 'Completed', fr: 'Terminé' }),
    Blocked: t({ en: 'Blocked', fr: 'Bloqué' }),
  }
  const label = statusLabels[statusLabel(state)] ?? statusLabel(state)
  const dotColor = aborting ? 'bg-amber-400' : state === 'paused' ? 'bg-accent-warning' : 'bg-accent-primary'
  const showBounce = state === 'running' || state === 'pausing'
  const lastPromptAtText = lastPromptAt ? formatTimeSince(lastPromptAt, now) : ''

  return (
    <div
      className="flex items-center gap-3 text-xs text-text-muted py-2"
      data-testid="session-status-indicator"
      data-state={state}
    >
      <div className="flex items-center gap-1.5">
        {showBounce && (
          <span className="flex gap-0.5">
            <span
              className={`w-1 h-1 rounded-full ${aborting ? '' : 'animate-bounce'} ${dotColor}`}
              style={{ animationDelay: '0ms' }}
            />
            <span
              className={`w-1 h-1 rounded-full ${aborting ? '' : 'animate-bounce'} ${dotColor}`}
              style={{ animationDelay: '150ms' }}
            />
            <span
              className={`w-1 h-1 rounded-full ${aborting ? '' : 'animate-bounce'} ${dotColor}`}
              style={{ animationDelay: '300ms' }}
            />
          </span>
        )}
        <span className="text-text-secondary">
          {aborting && state === 'running'
            ? `${label} ${t({ en: '(abort in progress)', fr: '(interruption en cours)' })}`
            : label}
        </span>
      </div>
      {!aborting && state === 'running' && (
        <span className="text-text-muted hidden sm:inline">
          {t({ en: 'esc to interrupt', fr: 'échap pour stopper' })}
        </span>
      )}
      {timerActive && lastPromptAtText && (
        <span
          className="text-text-muted hidden sm:inline"
          aria-label={t({ en: 'time since last prompt', fr: 'temps depuis la dernière invite' })}
        >
          {lastPromptAtText}
        </span>
      )}
    </div>
  )
}
