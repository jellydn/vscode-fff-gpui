import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSocketPath } from '../src/config'

const { getConfigurationMock, getMock } = vi.hoisted(() => ({
  getConfigurationMock: vi.fn(),
  getMock: vi.fn(),
}))

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: getConfigurationMock,
  },
}))

describe('getSocketPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getConfigurationMock.mockReturnValue({ get: getMock })
  })

  it('calls getConfiguration with the correct section name', () => {
    getMock.mockReturnValue('')

    getSocketPath()

    expect(getConfigurationMock).toHaveBeenCalledWith('fff-gpui')
  })

  it('returns the configured socket path string when set', () => {
    getMock.mockReturnValue('/custom/fff-gpui.sock')

    const result = getSocketPath()

    expect(result).toBe('/custom/fff-gpui.sock')
  })

  it('returns undefined when setting is not configured (empty string default)', () => {
    getMock.mockReturnValue('')

    const result = getSocketPath()

    expect(result).toBeUndefined()
  })

  it('returns undefined when get returns null', () => {
    getMock.mockReturnValue(null)

    const result = getSocketPath()

    expect(result).toBeUndefined()
  })
})
