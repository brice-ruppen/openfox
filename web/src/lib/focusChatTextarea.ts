import { shouldAutofocus } from './device'

export const CHAT_TEXTAREA_ID = 'openfox-chat-textarea'

export function focusChatTextarea(preventScroll?: boolean): void {
  if (!shouldAutofocus()) return
  const focusedPane = document.querySelector('[data-split-pane][data-focused="true"]')
  const textarea = focusedPane
    ? focusedPane.querySelector<HTMLTextAreaElement>(`textarea[id="${CHAT_TEXTAREA_ID}"]`)
    : document.getElementById(CHAT_TEXTAREA_ID)
  if (textarea) {
    if (preventScroll === undefined) {
      textarea.focus()
    } else {
      textarea.focus({ preventScroll })
    }
  }
}
