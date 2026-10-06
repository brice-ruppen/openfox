// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { focusChatTextarea, CHAT_TEXTAREA_ID } from './focusChatTextarea'

const mockMatchMedia = (matches: boolean) =>
  vi.fn().mockImplementation(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))

describe('focusChatTextarea', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls element.focus() without preventScroll when called with no arguments', () => {
    const textarea = document.createElement('textarea')
    textarea.id = CHAT_TEXTAREA_ID
    document.body.appendChild(textarea)
    const focusSpy = vi.spyOn(textarea, 'focus')

    focusChatTextarea()

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(focusSpy).toHaveBeenCalledWith()
  })

  it('calls element.focus({ preventScroll: true }) when called with true', () => {
    const textarea = document.createElement('textarea')
    textarea.id = CHAT_TEXTAREA_ID
    document.body.appendChild(textarea)
    const focusSpy = vi.spyOn(textarea, 'focus')

    focusChatTextarea(true)

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('calls element.focus({ preventScroll: false }) when called with false', () => {
    const textarea = document.createElement('textarea')
    textarea.id = CHAT_TEXTAREA_ID
    document.body.appendChild(textarea)
    const focusSpy = vi.spyOn(textarea, 'focus')

    focusChatTextarea(false)

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: false })
  })

  it('restores the composer in the focused split pane instead of the first textarea', () => {
    const left = document.createElement('div')
    left.setAttribute('data-split-pane', 'left')
    left.setAttribute('data-focused', 'false')
    const right = document.createElement('div')
    right.setAttribute('data-split-pane', 'right')
    right.setAttribute('data-focused', 'true')
    const leftTextarea = document.createElement('textarea')
    leftTextarea.id = CHAT_TEXTAREA_ID
    const rightTextarea = document.createElement('textarea')
    rightTextarea.id = CHAT_TEXTAREA_ID
    left.appendChild(leftTextarea)
    right.appendChild(rightTextarea)
    document.body.append(left, right)
    focusChatTextarea()
    expect(document.activeElement).toBe(rightTextarea)
  })

  it('silently does nothing when textarea element does not exist', () => {
    expect(() => focusChatTextarea()).not.toThrow()
    expect(() => focusChatTextarea(true)).not.toThrow()
    expect(() => focusChatTextarea(false)).not.toThrow()
  })

  it('does not focus on coarse-pointer (touch) devices', () => {
    vi.stubGlobal('window', { matchMedia: mockMatchMedia(true) } as any)
    const textarea = document.createElement('textarea')
    textarea.id = CHAT_TEXTAREA_ID
    document.body.appendChild(textarea)
    const focusSpy = vi.spyOn(textarea, 'focus')

    focusChatTextarea()

    expect(focusSpy).not.toHaveBeenCalled()
  })

  it('focuses on fine-pointer (desktop) devices', () => {
    vi.stubGlobal('window', { matchMedia: mockMatchMedia(false) } as any)
    const textarea = document.createElement('textarea')
    textarea.id = CHAT_TEXTAREA_ID
    document.body.appendChild(textarea)
    const focusSpy = vi.spyOn(textarea, 'focus')

    focusChatTextarea()

    expect(focusSpy).toHaveBeenCalledTimes(1)
  })
})
