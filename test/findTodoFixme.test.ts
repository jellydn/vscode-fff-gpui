import * as path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  execMock,
  sendCommandMock,
  getSocketPathMock,
  showErrorMessageMock,
  showInformationMessageMock,
  openTextDocumentMock,
  showTextDocumentMock,
  fsMock,
} = vi.hoisted(() => ({
  execMock: vi.fn(),
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
  exec: execMock,
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

import { findTodoFixme } from '../src/commands/findTodoFixme'

describe('findTodoFixme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSocketPathMock.mockReturnValue('')
    sendCommandMock.mockResolvedValue({ paths: [] })
    fsMock.statSync.mockReturnValue({ isDirectory: () => true })
    execMock.mockImplementation((cmd: string, options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback
      let stdout = ''
      if (cmd.startsWith('rg ')) {
        stdout = 'src/extension.ts\nsrc/client.ts\n'
      }
      cb(null, { stdout, stderr: '' })
    })
  })

  it('runs rg command to get files with TODO, creates overlay, spawns fff-gpui with in_grep: true, and cleans up', async () => {
    sendCommandMock.mockImplementation(async (command) => ({
      paths: [{ path: path.join(command.path, 'src/client.ts') }],
    }))

    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/src/client.ts' } })

    await findTodoFixme()

    // Verify rg call
    expect(execMock).toHaveBeenCalledWith(
      expect.stringContaining('rg -l --smart-case'),
      expect.any(Object),
      expect.any(Function),
    )

    // Verify overlay folder creation
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('/mock/workspace', '.git', '.fff-gpui-temp-')),
      { recursive: true },
    )

    // Verify socket command was sent with the temp dir and in_grep: true
    expect(sendCommandMock).toHaveBeenCalledWith(
      {
        cmd: 'open_path',
        path: expect.stringContaining(path.join('/mock/workspace', '.git', '.fff-gpui-temp-')),
        in_grep: true,
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

  it('falls back to git grep if rg fails', async () => {
    execMock.mockImplementation((cmd: string, options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback
      if (cmd.startsWith('rg ')) {
        cb(new Error('rg not found'), null)
      } else if (cmd.startsWith('git grep ')) {
        cb(null, { stdout: 'src/extension.ts\n', stderr: '' })
      }
    })

    await findTodoFixme()

    expect(execMock).toHaveBeenCalledWith(
      expect.stringContaining('git grep -l'),
      expect.any(Object),
      expect.any(Function),
    )
  })

  it('shows information message if there are no files with TODOs', async () => {
    execMock.mockImplementation((cmd: string, options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback
      cb(new Error('no matches'), null)
    })

    await findTodoFixme()

    expect(showInformationMessageMock).toHaveBeenCalledWith('No TODO/FIXME comments found.')
    expect(sendCommandMock).not.toHaveBeenCalled()
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
