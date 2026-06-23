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
import { pickGitStatus } from '../src/commands/pickGitStatus'

describe('pickGitStatus', () => {
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
        if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
          stdout = '/mock/workspace\n'
        } else if (args[0] === 'status') {
          stdout = ' M src/extension.ts\n?? test.txt\n'
        } else if (args[0] === 'ls-files') {
          stdout = 'test.txt\n'
        }
      }
      cb(null, { stdout, stderr: '' })
    })
  })

  it('runs git commands to get changed files, creates overlay, spawns fff-gpui, and cleans up', async () => {
    sendCommandMock.mockImplementation(async (command) => ({
      paths: [{ path: path.join(command.path, 'src/extension.ts') }],
    }))

    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/src/extension.ts' } })

    await pickGitStatus()

    // Verify git calls
    expect(execFileMock).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--show-toplevel'],
      expect.any(Object),
      expect.any(Function),
    )
    expect(execFileMock).toHaveBeenCalledWith(
      'git',
      ['status', '--porcelain'],
      expect.any(Object),
      expect.any(Function),
    )
    expect(execFileMock).toHaveBeenCalledWith(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      expect.any(Object),
      expect.any(Function),
    )

    // Verify overlay folder creation
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('/mock/workspace', '.git', '.fff-gpui-temp-')),
      { recursive: true },
    )

    // Verify socket command was sent with the temp dir
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
      expect.objectContaining({ fsPath: '/mock/workspace/src/extension.ts' }),
    )

    // Verify cleanup was run
    expect(fsMock.rmSync).toHaveBeenCalledWith(
      expect.stringContaining(path.join('/mock/workspace', '.git', '.fff-gpui-temp-')),
      { recursive: true, force: true },
    )
  })

  it('shows information message if there are no modified files', async () => {
    execFileMock.mockImplementation((file: string, args: string[], options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback
      let stdout = ''
      if (file === 'git' && args[0] === 'rev-parse') {
        stdout = '/mock/workspace\n'
      }
      cb(null, { stdout, stderr: '' })
    })

    await pickGitStatus()

    expect(showInformationMessageMock).toHaveBeenCalledWith('No changes in the git repository.')
    expect(sendCommandMock).not.toHaveBeenCalled()
  })

  it('handles git status renames correctly', async () => {
    execFileMock.mockImplementation((file: string, args: string[], options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback
      let stdout = ''
      if (file === 'git') {
        if (args[0] === 'rev-parse') {
          stdout = '/mock/workspace\n'
        } else if (args[0] === 'status') {
          stdout = 'R  old.ts -> new.ts\n'
        }
      }
      cb(null, { stdout, stderr: '' })
    })

    sendCommandMock.mockImplementation(async (command) => ({
      paths: [{ path: path.join(command.path, 'new.ts') }],
    }))

    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/new.ts' } })

    await pickGitStatus()

    // It should link new.ts, not old.ts
    expect(fsMock.linkSync).toHaveBeenCalledWith(
      expect.stringContaining('new.ts'),
      expect.stringContaining('new.ts'),
    )
  })

  it('shows error message when no workspace folder is open', async () => {
    ;(vscode.workspace as any).workspaceFolders = undefined

    await pickGitStatus()

    expect(showErrorMessageMock).toHaveBeenCalledWith(
      'fff-gpui: Git Status requires an open workspace folder.',
    )
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('shows error message when sendCommand throws', async () => {
    sendCommandMock.mockRejectedValue(new Error('daemon not running'))

    await pickGitStatus()

    expect(showErrorMessageMock).toHaveBeenCalledWith('fff-gpui: Error: daemon not running')
    // Cleanup should still run even on error
    expect(fsMock.rmSync).toHaveBeenCalled()
  })

  it('filters out deleted files from git status', async () => {
    execFileMock.mockImplementation((file: string, args: string[], options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback
      let stdout = ''
      if (file === 'git') {
        if (args[0] === 'rev-parse') {
          stdout = '/mock/workspace\n'
        } else if (args[0] === 'status') {
          stdout = ' M src/modified.ts\n D src/deleted.ts\n?? src/untracked.ts\n'
        }
      }
      cb(null, { stdout, stderr: '' })
    })

    sendCommandMock.mockImplementation(async (command: { path: string }) => ({
      paths: [{ path: path.join(command.path, 'src/modified.ts') }],
    }))

    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/src/modified.ts' } })

    await pickGitStatus()

    // Deleted file should not be linked
    // Each call to linkSync for the first arg (destPath) should NOT contain 'deleted.ts'
    const linkCalls = (fsMock.linkSync as ReturnType<typeof vi.fn>).mock.calls
    for (const call of linkCalls) {
      expect(call[0]).not.toContain('deleted.ts')
    }

    // Modified and untracked should be linked (from status output + ls-files)
    const allLinkedFiles = linkCalls.map((c: string[]) => c[0])
    expect(allLinkedFiles.some((f) => f?.includes('modified.ts'))).toBe(true)
  })

  it('filters out files outside workspace root', async () => {
    execFileMock.mockImplementation((file: string, args: string[], options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback
      let stdout = ''
      if (file === 'git') {
        if (args[0] === 'rev-parse') {
          stdout = '/other/repo\n'
        } else if (args[0] === 'status') {
          stdout = ' M ../outside.ts\n'
        }
      }
      cb(null, { stdout, stderr: '' })
    })

    await pickGitStatus()

    expect(showInformationMessageMock).toHaveBeenCalledWith('No changes in the git repository.')
    expect(sendCommandMock).not.toHaveBeenCalled()
  })

  it('opens multiple files when user selects several entries', async () => {
    execFileMock.mockImplementation((file: string, args: string[], options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback
      let stdout = ''
      if (file === 'git') {
        if (args[0] === 'rev-parse') {
          stdout = '/mock/workspace\n'
        } else if (args[0] === 'status') {
          stdout = ' M src/a.ts\n M src/b.ts\n'
        }
      }
      cb(null, { stdout, stderr: '' })
    })

    sendCommandMock.mockImplementation(async (command: { path: string }) => ({
      paths: [
        { path: path.join(command.path, 'src/a.ts') },
        { path: path.join(command.path, 'src/b.ts') },
      ],
    }))

    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/src/a.ts' } })

    await pickGitStatus()

    expect(openTextDocumentMock).toHaveBeenCalledTimes(2)
    expect(openTextDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/mock/workspace/src/a.ts' }),
    )
    expect(openTextDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/mock/workspace/src/b.ts' }),
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
      paths: [{ path: path.join(command.path, 'src/extension.ts') }],
    }))

    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/src/extension.ts' } })

    await pickGitStatus()

    // Verify temp folder path contains fff-gpui-temp but NOT inside .git
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(
      expect.stringMatching(/\/mock\/workspace\/\.fff-gpui-temp-[a-f0-9]+$/),
      { recursive: true },
    )
  })
})
