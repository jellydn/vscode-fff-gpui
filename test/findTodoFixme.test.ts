import * as path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  execFileMock,
  sendCommandMock,
  getSocketPathMock,
  showErrorMessageMock,
  showInformationMessageMock,
  openTextDocumentMock,
  showTextDocumentMock,
  fsMock,
} = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  sendCommandMock: vi.fn(),
  getSocketPathMock: vi.fn(),
  showErrorMessageMock: vi.fn(),
  showInformationMessageMock: vi.fn(),
  openTextDocumentMock: vi.fn(),
  showTextDocumentMock: vi.fn(),
  fsMock: {
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
    linkSync: vi.fn(),
    symlinkSync: vi.fn(),
    copyFileSync: vi.fn(),
    rmSync: vi.fn(),
  },
}))

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}))

vi.mock('node:fs', () => fsMock)

vi.mock('../src/client', () => ({
  sendCommand: sendCommandMock,
  resolveSocketPath: (s: string) => s,
  verifySocketSecurity: () => {},
}))

vi.mock('../src/config', () => ({
  getSocketPath: getSocketPathMock,
}))

vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
    openTextDocument: openTextDocumentMock,
  },
  window: {
    showErrorMessage: showErrorMessageMock,
    showInformationMessage: showInformationMessageMock,
    showTextDocument: showTextDocumentMock,
    createOutputChannel: () => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    }),
  },
  Uri: {
    file: (p: string) => ({
      fsPath: p,
      scheme: 'file',
      path: p,
    }),
  },
}))

import * as vscode from 'vscode'
import { findTodoFixme } from '../src/commands/findTodoFixme'

describe('findTodoFixme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSocketPathMock.mockReturnValue('')
    sendCommandMock.mockResolvedValue({ paths: [] })
    fsMock.statSync.mockReturnValue({ isDirectory: () => true })
    ;(vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/mock/workspace' } }]
    execFileMock.mockImplementation((file: string, args: string[], options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback
      let stdout = ''
      if (file === 'git') {
        stdout = 'src/extension.ts\nsrc/client.ts\n'
      }
      cb(null, { stdout, stderr: '' })
    })
  })

  it('runs git grep command with --untracked and dot path, creates overlay, spawns fff-gpui in file finder mode, and cleans up', async () => {
    sendCommandMock.mockImplementation(async (command) => ({
      paths: [{ path: path.join(command.path, 'src/client.ts') }],
    }))

    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/src/client.ts' } })

    await findTodoFixme()

    // Verify git grep is called with aligned pattern and dot path
    expect(execFileMock).toHaveBeenCalledWith(
      'git',
      [
        'grep',
        '--untracked',
        '-l',
        '-w',
        '-E',
        '-e',
        '(TODO|FIXME|HACK|FIX)',
        '-e',
        '(todo|fixme|hack|fix)(:|[[:space:]]+-|[[:space:]]*\\()',
        '.',
      ],
      expect.any(Object),
      expect.any(Function),
    )

    // Verify overlay folder creation
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('/mock/workspace', '.git', '.fff-gpui-temp-')),
      { recursive: true },
    )

    // Verify socket command was sent with the temp dir and in_grep: false
    expect(sendCommandMock).toHaveBeenCalledWith(
      {
        cmd: 'open_path',
        path: expect.stringContaining(path.join('/mock/workspace', '.git', '.fff-gpui-temp-')),
        in_grep: false,
      },
      undefined,
      '/mock/workspace',
    )

    // Verify file opening (should map path back to workspaceRoot)
    expect(openTextDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/mock/workspace/src/client.ts' }),
    )

    // Verify cleanup was run
    expect(fsMock.rmSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('/mock/workspace', '.git', '.fff-gpui-temp-')),
      { recursive: true, force: true },
    )
  })

  it('shows information message if there are no files with TODOs', async () => {
    execFileMock.mockImplementation((file: string, args: string[], options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback
      cb(new Error('no matches'), null)
    })

    await findTodoFixme()

    expect(showInformationMessageMock).toHaveBeenCalledWith('No TODO/FIXME comments found.')
    expect(sendCommandMock).not.toHaveBeenCalled()
  })

  it('shows error message when no workspace folder is open', async () => {
    ;(vscode.workspace as any).workspaceFolders = undefined

    await findTodoFixme()

    expect(showErrorMessageMock).toHaveBeenCalledWith(
      'fff-gpui: TODO search requires an open workspace folder.',
    )
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('shows error message when sendCommand throws', async () => {
    sendCommandMock.mockRejectedValue(new Error('daemon not running'))

    await findTodoFixme()

    expect(showErrorMessageMock).toHaveBeenCalledWith('fff-gpui: Error: daemon not running')
    // Cleanup should still run even on error
    expect(fsMock.rmSync).toHaveBeenCalled()
  })

  it('opens multiple files when user selects several entries', async () => {
    const files = ['src/a.ts', 'src/b.ts', 'src/c.ts']

    execFileMock.mockImplementation(
      (_file: string, _args: string[], _options: any, callback: any) => {
        callback(null, { stdout: files.join('\n'), stderr: '' })
      },
    )

    sendCommandMock.mockImplementation(async (command: { path: string }) => ({
      paths: [
        { path: path.join(command.path, 'src/a.ts') },
        { path: path.join(command.path, 'src/b.ts') },
        { path: path.join(command.path, 'src/c.ts') },
      ],
    }))

    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/src/a.ts' } })

    await findTodoFixme()

    expect(openTextDocumentMock).toHaveBeenCalledTimes(3)
    expect(openTextDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/mock/workspace/src/a.ts' }),
    )
    expect(openTextDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/mock/workspace/src/b.ts' }),
    )
    expect(openTextDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/mock/workspace/src/c.ts' }),
    )
  })

  it('falls back to workspace root when .git is not a directory', async () => {
    fsMock.statSync.mockImplementation((p: string) => {
      if (p.endsWith('.git')) {
        return { isDirectory: () => false }
      }
      return { isDirectory: () => true }
    })

    sendCommandMock.mockImplementation(async (command) => ({
      paths: [{ path: path.join(command.path, 'src/client.ts') }],
    }))

    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/src/client.ts' } })

    await findTodoFixme()

    // Verify temp folder path contains fff-gpui-temp but NOT inside .git
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(
      expect.stringMatching(/\/mock\/workspace\/\.fff-gpui-temp-[a-f0-9]+$/),
      { recursive: true },
    )
  })
})
