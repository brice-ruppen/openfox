/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from './clipboard'

const originalClipboard = navigator.clipboard
const originalIsSecureContext = window.isSecureContext
const originalExecCommand = document.execCommand

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard })
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: originalIsSecureContext })
  Object.defineProperty(document, 'execCommand', { configurable: true, value: originalExecCommand })
  document.querySelectorAll('textarea').forEach((element) => element.remove())
})

describe('copyToClipboard', () => {
  it('uses the Clipboard API in a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })

    await copyToClipboard('B32Q-5HMN2')

    expect(writeText).toHaveBeenCalledWith('B32Q-5HMN2')
  })

  it('falls back to execCommand when the Clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Not allowed'))
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })

    await copyToClipboard('B32Q-5HMN2')

    expect(writeText).toHaveBeenCalledWith('B32Q-5HMN2')
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('falls back to execCommand outside a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })

    await copyToClipboard('B32Q-5HMN2')

    expect(writeText).not.toHaveBeenCalled()
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('rejects when the fallback cannot copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn().mockReturnValue(false) })

    await expect(copyToClipboard('B32Q-5HMN2')).rejects.toThrow('Clipboard copy failed')
    expect(document.querySelector('textarea')).toBeNull()
  })
})
