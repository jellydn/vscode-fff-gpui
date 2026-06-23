import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showInformationMessageMock, sendCommandMock } = vi.hoisted(() => ({
  showInformationMessageMock: vi.fn(),
  sendCommandMock: vi.fn().mockResolvedValue({ paths: [] }),
}))

vi.mock('vscode', () => ({
  window: {
    showInformationMessage: showInformationMessageMock,
    showErrorMessage: vi.fn(),
    showTextDocument: vi.fn(),
    createOutputChannel: () => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    }),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
    openTextDocument: vi.fn(),
  },
  Uri: {
    file: (p: string) => ({ fsPath: p, scheme: 'file', path: p }),
  },
}))

vi.mock('../src/client', () => ({
  sendCommand: sendCommandMock,
  resolveSocketPath: (s: string) => s,
  verifySocketSecurity: () => {},
}))

vi.mock('../src/config', () => ({
  getSocketPath: vi.fn().mockReturnValue(''),
}))

import { getLastSearch, saveSearch } from '../src/commands/resumeSearch'

describe('resumeSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to a known state
    saveSearch('files')
  })

  it('saveSearch stores a search kind and getLastSearch retrieves it', () => {
    saveSearch('grep')
    expect(getLastSearch()).toEqual({ kind: 'grep' })
  })

  it('saveSearch overwrites previous search', () => {
    saveSearch('todo-fixme')
    expect(getLastSearch()?.kind).toBe('todo-fixme')
    saveSearch('git-status')
    expect(getLastSearch()?.kind).toBe('git-status')
  })

  it('stores and retrieves files-with-type', () => {
    saveSearch('files-with-type')
    expect(getLastSearch()?.kind).toBe('files-with-type')
  })

  it('stores and retrieves grep-with-type', () => {
    saveSearch('grep-with-type')
    expect(getLastSearch()?.kind).toBe('grep-with-type')
  })
})
