import { describe, it, expect } from 'vitest'
import { parseKeybindings, DEFAULT_KEYBINDINGS } from './keybindings'

describe('parseKeybindings', () => {
  it('returns defaults for empty or invalid input', () => {
    expect(parseKeybindings(undefined)).toEqual(DEFAULT_KEYBINDINGS)
    expect(parseKeybindings('not json')).toEqual(DEFAULT_KEYBINDINGS)
  })

  it('falls back to defaults for missing keys', () => {
    const config = parseKeybindings('{}')
    expect(config.terminalToggle).toEqual(DEFAULT_KEYBINDINGS.terminalToggle)
    expect(config.quickAction).toEqual(DEFAULT_KEYBINDINGS.quickAction)
  })

  it('leaves openSplitView unassigned for new and existing configurations', () => {
    expect(DEFAULT_KEYBINDINGS.openSplitView).toBeNull()
    expect(parseKeybindings(undefined).openSplitView).toBeNull()
    expect(parseKeybindings('{}').openSplitView).toBeNull()
  })

  it('preserves custom and disabled split-view bindings', () => {
    const binding = { type: 'chord', key: 'v', modifiers: ['ctrl', 'shift'] }
    expect(parseKeybindings(JSON.stringify({ openSplitView: binding })).openSplitView).toEqual(binding)
    expect(parseKeybindings(JSON.stringify({ openSplitView: null })).openSplitView).toBeNull()
  })

  it('includes criteriaSidebar in defaults', () => {
    expect(DEFAULT_KEYBINDINGS.criteriaSidebar).toEqual({ type: 'chord', key: 'd', modifiers: ['ctrl'] })
  })

  it('preserves explicit null (disabled shortcut) instead of restoring defaults', () => {
    const config = parseKeybindings(JSON.stringify({ terminalToggle: null, quickAction: null }))
    expect(config.terminalToggle).toBeNull()
    expect(config.quickAction).toBeNull()
    expect(config.agentSwitching).toEqual(DEFAULT_KEYBINDINGS.agentSwitching)
  })

  it('preserves null entries in agentSwitching', () => {
    const config = parseKeybindings(
      JSON.stringify({ agentSwitching: [null, { type: 'chord', key: '2', modifiers: ['ctrl'] }] }),
    )
    expect(config.agentSwitching[0]).toBeNull()
    expect(config.agentSwitching[1]).toEqual({ type: 'chord', key: '2', modifiers: ['ctrl'] })
  })
})
