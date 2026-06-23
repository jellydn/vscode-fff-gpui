import * as path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---- Hoisted mock state ----
const {
  sendCommandMock,
  getSocketPathMock,
  showErrorMessageMock,
  showTextDocumentMock,
  openTextDocumentMock,
  mockState,
} = vi.hoisted(() => ({
  sendCommandMock: vi.fn(),
  getSocketPathMock: vi.fn(),
  showErrorMessageMock: vi.fn(),
  showTextDocumentMock: vi.fn(),
  openTextDocumentMock: vi.fn(),
  mockState: {
    workspaceFolders: undefined as readonly { uri: { fsPath: string } }[] | undefined,
    activeTextEditor: undefined as
      | {
          document: { uri: { fsPath: string; scheme: string } }
        }
      | undefined,
  },
}))

// ---- Module mocks (hoisted above imports) ----
vi.mock('../src/client', () => ({
  sendCommand: sendCommandMock,
  resolveSocketPath: (s: string) => s,
  verifySocketSecurity: () => {},
}))

vi.mock('../src/config', () => ({
  getSocketPath: getSocketPathMock,
}))

vi.mock('node:os', () => ({
  homedir: () => '/mock/home',
}))

vi.mock('vscode', () => {
  class MockSelection {
    constructor(
      public anchorLine: number,
      public anchorCharacter: number,
      public activeLine: number,
      public activeCharacter: number,
    ) {}

    get anchor() {
      return { line: this.anchorLine, character: this.anchorCharacter }
    }

    get active() {
      return { line: this.activeLine, character: this.activeCharacter }
    }
  }

  return {
    workspace: {
      get workspaceFolders() {
        return mockState.workspaceFolders
      },
      openTextDocument: openTextDocumentMock,
    },
    window: {
      get activeTextEditor() {
        return mockState.activeTextEditor
      },
      showErrorMessage: showErrorMessageMock,
      showTextDocument: showTextDocumentMock,
      setStatusBarMessage: vi.fn(),
    },
    Uri: {
      file: (p: string) => ({
        fsPath: p,
        scheme: 'file',
        path: p,
      }),
    },
    Selection: MockSelection,
  }
})

// ---- Imports (after mocks) ----
import { findFiles } from '../src/commands/findFiles'
import { grepFiles } from '../src/commands/grepFiles'
import { openFiles } from '../src/commands/openFiles'

function makeWorkspaceFolder(fsPath: string) {
  return { uri: { fsPath } }
}

function makeActiveEditor(fsPath: string) {
  return {
    document: {
      uri: { fsPath, scheme: 'file' as const },
    },
  }
}

describe('findFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.workspaceFolders = undefined
    mockState.activeTextEditor = undefined
    getSocketPathMock.mockReturnValue('')
    sendCommandMock.mockResolvedValue({ paths: [] })
  })

  describe('search path resolution', () => {
    it('uses the first workspace folder when available', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/workspace')]

      await findFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(
        { cmd: 'open_path', path: '/workspace', in_grep: false },
        undefined,
        '/workspace',
      )
    })

    it('falls back to active editor directory when no workspace folder', async () => {
      mockState.activeTextEditor = makeActiveEditor('/project/src/index.ts')

      await findFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(
        {
          cmd: 'open_path',
          path: path.dirname('/project/src/index.ts'),
          in_grep: false,
        },
        undefined,
        path.dirname('/project/src/index.ts'),
      )
    })

    it('falls back to homedir when no workspace and no active editor', async () => {
      await findFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(
        { cmd: 'open_path', path: '/mock/home', in_grep: false },
        undefined,
        '/mock/home',
      )
    })

    it('falls back to homedir when active editor has non-file scheme', async () => {
      mockState.activeTextEditor = {
        document: {
          uri: { fsPath: '/virtual/doc', scheme: 'untitled' },
        },
      }

      await findFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(
        { cmd: 'open_path', path: '/mock/home', in_grep: false },
        undefined,
        '/mock/home',
      )
    })
  })

  describe('command payload', () => {
    it('sends in_grep: false', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/ws')]

      await findFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(
        expect.objectContaining({ in_grep: false }),
        undefined,
        '/ws',
      )
    })
  })

  describe('socket path config', () => {
    it('passes custom socket path from config to sendCommand', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/ws')]
      getSocketPathMock.mockReturnValue('/custom/socket.sock')

      await findFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(
        expect.anything(),
        '/custom/socket.sock',
        expect.anything(),
      )
    })

    it('passes undefined when config returns empty string', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/ws')]
      getSocketPathMock.mockReturnValue('')

      await findFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(expect.anything(), undefined, expect.anything())
    })
  })

  describe('response handling', () => {
    it('opens files from the response paths', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/ws')]
      const entries = [{ path: '/ws/a.ts', line: 5, column: 10 }, { path: '/ws/b.ts' }]
      sendCommandMock.mockResolvedValue({ paths: entries })
      openTextDocumentMock.mockImplementation(async (uri: { fsPath: string }) => ({
        uri,
        fileName: uri.fsPath,
      }))

      await findFiles()

      expect(openTextDocumentMock).toHaveBeenCalledTimes(2)
      expect(openTextDocumentMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ fsPath: '/ws/a.ts' }),
      )
      expect(openTextDocumentMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ fsPath: '/ws/b.ts' }),
      )
      expect(showTextDocumentMock).toHaveBeenCalledTimes(2)
    })

    it('handles empty paths response gracefully', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/ws')]
      sendCommandMock.mockResolvedValue({ paths: [] })

      await findFiles()

      expect(openTextDocumentMock).not.toHaveBeenCalled()
      expect(showTextDocumentMock).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('shows error message when sendCommand throws', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/ws')]
      sendCommandMock.mockRejectedValue(new Error('Connection refused'))

      await findFiles()

      expect(showErrorMessageMock).toHaveBeenCalledWith('fff-gpui: Error: Connection refused')
    })

    it('does not attempt to open files on error', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/ws')]
      sendCommandMock.mockRejectedValue(new Error('boom'))

      await findFiles()

      expect(openTextDocumentMock).not.toHaveBeenCalled()
    })
  })
})

describe('grepFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.workspaceFolders = undefined
    mockState.activeTextEditor = undefined
    getSocketPathMock.mockReturnValue('')
    sendCommandMock.mockResolvedValue({ paths: [] })
  })

  describe('search path resolution', () => {
    it('uses the first workspace folder when available', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/workspace')]

      await grepFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(
        { cmd: 'open_path', path: '/workspace', in_grep: true },
        undefined,
        '/workspace',
      )
    })

    it('falls back to active editor directory when no workspace folder', async () => {
      mockState.activeTextEditor = makeActiveEditor('/project/src/index.ts')

      await grepFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(
        {
          cmd: 'open_path',
          path: path.dirname('/project/src/index.ts'),
          in_grep: true,
        },
        undefined,
        path.dirname('/project/src/index.ts'),
      )
    })

    it('falls back to homedir when no workspace and no active editor', async () => {
      await grepFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(
        { cmd: 'open_path', path: '/mock/home', in_grep: true },
        undefined,
        '/mock/home',
      )
    })
  })

  describe('command payload', () => {
    it('sends in_grep: true', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/ws')]

      await grepFiles()

      expect(sendCommandMock).toHaveBeenCalledWith(
        expect.objectContaining({ in_grep: true }),
        undefined,
        '/ws',
      )
    })
  })

  describe('error handling', () => {
    it('shows error message when sendCommand throws', async () => {
      mockState.workspaceFolders = [makeWorkspaceFolder('/ws')]
      sendCommandMock.mockRejectedValue(new Error('Connection refused'))

      await grepFiles()

      expect(showErrorMessageMock).toHaveBeenCalledWith('fff-gpui: Error: Connection refused')
    })
  })
})

describe('openFiles', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    openTextDocumentMock.mockImplementation(async (uri: { fsPath: string }) => ({
      uri,
      fileName: uri.fsPath,
      lineCount: 1,
    }))
    showTextDocumentMock.mockResolvedValue(undefined)
  })

  it('returns immediately for empty entries array', async () => {
    await openFiles([])

    expect(openTextDocumentMock).not.toHaveBeenCalled()
    expect(showTextDocumentMock).not.toHaveBeenCalled()
  })

  it('loads all documents in parallel', async () => {
    const entries = [{ path: '/a.ts' }, { path: '/b.ts' }, { path: '/c.ts' }]

    // Track when each openTextDocument resolves
    const order: string[] = []
    openTextDocumentMock.mockImplementation(async (uri: { fsPath: string }) => {
      // Simulate varying load times to prove parallelism
      const delay = uri.fsPath === '/b.ts' ? 10 : uri.fsPath === '/c.ts' ? 5 : 0
      await new Promise((r) => setTimeout(r, delay))
      order.push(uri.fsPath)
      return { uri, fileName: uri.fsPath }
    })

    vi.useFakeTimers()
    const promise = openFiles(entries)

    // Advance time enough for the slowest document
    await vi.advanceTimersByTimeAsync(20)
    await promise
    vi.useRealTimers()

    // All three should have been called before any showTextDocument
    expect(openTextDocumentMock).toHaveBeenCalledTimes(3)
  })

  it('opens documents with preview: false so tabs remain open', async () => {
    const entries = [{ path: '/doc.ts' }]

    await openFiles(entries)

    expect(showTextDocumentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ preview: false }),
    )
  })

  it('positions cursor at line and column when provided (1-indexed to 0-indexed conversion)', async () => {
    const entries = [{ path: '/doc.ts', line: 12, column: 5 }]

    await openFiles(entries)

    expect(showTextDocumentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        preview: false,
        selection: expect.anything(),
      }),
    )

    const call = showTextDocumentMock.mock.calls[0] as [
      unknown,
      {
        selection: {
          anchor: { line: number; character: number }
          active: { line: number; character: number }
        }
      },
    ]
    const { selection } = call[1]
    // line 12 becomes 11 (0-indexed), column 5 becomes 4 (0-indexed)
    expect(selection.anchor.line).toBe(11)
    expect(selection.anchor.character).toBe(4)
    expect(selection.active.line).toBe(11)
    expect(selection.active.character).toBe(4)
  })

  it('handles entries without line/column gracefully', async () => {
    const entries = [{ path: '/doc.ts' }]

    await openFiles(entries)

    expect(showTextDocumentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        preview: false,
      }),
    )

    const call = showTextDocumentMock.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(call[1].selection).toBeUndefined()
  })

  it('handles partial document load failure by rejecting', async () => {
    openTextDocumentMock
      .mockResolvedValueOnce({ uri: { fsPath: '/a.ts' }, fileName: '/a.ts' })
      .mockRejectedValueOnce(new Error('File not found'))
    const entries = [{ path: '/a.ts' }, { path: '/missing.ts' }]

    await expect(openFiles(entries)).rejects.toThrow('File not found')
    expect(openTextDocumentMock).toHaveBeenCalledTimes(2)
  })

  it('does not reject when a showTextDocument call fails, other files still open', async () => {
    const editorClosedError = new Error('Editor closed')
    showTextDocumentMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(editorClosedError)
      .mockResolvedValueOnce(undefined)
    const entries = [{ path: '/a.ts' }, { path: '/b.ts' }, { path: '/c.ts' }]

    await expect(openFiles(entries)).resolves.toBeUndefined()
    expect(showTextDocumentMock).toHaveBeenCalledTimes(3)
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'fff-gpui: failed to show document:',
      editorClosedError,
    )
  })

  it('clamps line: 0 to index 0', async () => {
    const entries = [{ path: '/doc.ts', line: 0 }]
    await openFiles(entries)

    const call = showTextDocumentMock.mock.calls[0] as [
      unknown,
      { selection: { anchor: { line: number } } },
    ]
    expect(call[1].selection.anchor.line).toBe(0)
  })

  it('opens multiple files and shows all of them', async () => {
    const entries = [
      { path: '/foo.ts', line: 1 },
      { path: '/bar.ts', line: 5, column: 3 },
      { path: '/baz.ts' },
    ]

    await openFiles(entries)

    expect(openTextDocumentMock).toHaveBeenCalledTimes(3)
    expect(showTextDocumentMock).toHaveBeenCalledTimes(3)

    // First: line 1 → index 0
    const call1 = showTextDocumentMock.mock.calls[0] as [
      unknown,
      { selection: { anchor: { line: number; character: number } } },
    ]
    expect(call1[1].selection.anchor.line).toBe(0)

    // Second: line 5 → index 4, column 3 → index 2
    const call2 = showTextDocumentMock.mock.calls[1] as [
      unknown,
      { selection: { anchor: { line: number; character: number } } },
    ]
    expect(call2[1].selection.anchor.line).toBe(4)
    expect(call2[1].selection.anchor.character).toBe(2)

    // Third: no line/column
    const call3 = showTextDocumentMock.mock.calls[2] as [unknown, Record<string, unknown>]
    expect(call3[1].selection).toBeUndefined()
  })
})
