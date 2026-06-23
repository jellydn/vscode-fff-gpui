import { beforeEach, describe, expect, it, vi } from 'vitest'
import { disposeLogger, log } from '../src/logger'

const { createOutputChannelMock, appendLineMock, disposeMock } = vi.hoisted(() => ({
  createOutputChannelMock: vi.fn(),
  appendLineMock: vi.fn(),
  disposeMock: vi.fn(),
}))

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: createOutputChannelMock,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Reset module-level state so each test starts fresh
  disposeLogger()
  createOutputChannelMock.mockReturnValue({
    appendLine: appendLineMock,
    dispose: disposeMock,
  })
})

describe('log', () => {
  it('creates the output channel on first call with name fff-gpui', () => {
    log('hello')

    expect(createOutputChannelMock).toHaveBeenCalledWith('fff-gpui')
  })

  it('appends an ISO-timestamped message to the channel', () => {
    log('some message')

    expect(appendLineMock).toHaveBeenCalledTimes(1)
    const callArg = appendLineMock.mock.calls[0]?.[0] as string
    expect(callArg).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] some message$/)
  })

  it('reuses the existing channel on subsequent calls', () => {
    log('first')
    log('second')

    expect(createOutputChannelMock).toHaveBeenCalledTimes(1)
  })

  it('appends to the channel on each call', () => {
    log('a')
    log('b')

    expect(appendLineMock).toHaveBeenCalledTimes(2)
  })
})

describe('disposeLogger', () => {
  it('disposes the output channel and clears the reference', () => {
    log('create channel')
    disposeLogger()

    // disposeLogger is called twice: once in beforeEach, once in the test
    expect(disposeMock).toHaveBeenCalled()
  })

  it('creates a new channel after dispose on next log call', () => {
    log('create channel')
    disposeLogger()
    log('recreated')

    expect(createOutputChannelMock).toHaveBeenCalledTimes(2)
  })
})
