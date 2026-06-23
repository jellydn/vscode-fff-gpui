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

let quickPickAcceptHandler: (() => void) | null = null
let quickPickHideHandler: (() => void) | null = null
const quickPickItems: any[] = [{ label: 'TypeScript (.ts, .tsx)' }]
const quickPickSelectedItems: any[] = [{ label: 'TypeScript (.ts, .tsx)' }]

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
    createQuickPick: () => ({
      items: quickPickItems,
      selectedItems: quickPickSelectedItems,
      placeholder: '',
      onDidAccept: (cb: () => void) => {
        quickPickAcceptHandler = cb
        return { dispose: vi.fn() }
      },
      onDidHide: (cb: () => void) => {
        quickPickHideHandler = cb
        return { dispose: vi.fn() }
      },
      show: vi.fn(),
      hide: () => {
        if (quickPickHideHandler) quickPickHideHandler()
      },
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
import { findFilesWithType, grepFilesWithType } from '../src/commands/findFilesWithType'

describe('findFilesWithType', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quickPickAcceptHandler = null
    quickPickHideHandler = null
    quickPickSelectedItems.length = 0
    quickPickSelectedItems.push({ label: 'TypeScript (.ts, .tsx)' })
    getSocketPathMock.mockReturnValue('')
    sendCommandMock.mockResolvedValue({ paths: [] })
    fsMock.statSync.mockReturnValue({ isDirectory: () => true })
    ;(vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: '/mock/workspace' } }]

    execFileMock.mockImplementation(
      (_file: string, _args: string[], _options: any, callback: any) => {
        callback(null, { stdout: 'src/a.ts\nsrc/b.ts\n', stderr: '' })
      },
    )
  })

  // Helper: simulate the QuickPick flow
  async function runWithTypeFilter(typeLabel: string) {
    quickPickSelectedItems.length = 0
    if (typeLabel) {
      quickPickSelectedItems.push({ label: typeLabel })
    }
    // Simulate accepting then hiding
    return { accept: () => quickPickAcceptHandler?.(), hide: () => quickPickHideHandler?.() }
  }

  it('runs rg --files --type with the selected type and opens in find mode', async () => {
    sendCommandMock.mockImplementation(async (command: { path: string }) => ({
      paths: [{ path: path.join(command.path, 'src/a.ts') }],
    }))
    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/src/a.ts' } })

    // Start the command (runs async)
    const promise = findFilesWithType()
    // Trigger the QuickPick accept
    await new Promise((r) => setTimeout(r, 10))
    quickPickAcceptHandler?.()
    quickPickHideHandler?.()
    await promise

    expect(execFileMock).toHaveBeenCalledWith(
      'rg',
      ['--files', '--type', 'ts'],
      expect.any(Object),
      expect.any(Function),
    )
    expect(sendCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({ in_grep: false }),
      undefined,
      '/mock/workspace',
    )
  })

  it('grepFilesWithType uses in_grep: true', async () => {
    sendCommandMock.mockImplementation(async (command: { path: string }) => ({
      paths: [{ path: path.join(command.path, 'src/a.ts') }],
    }))
    openTextDocumentMock.mockResolvedValue({ uri: { fsPath: '/mock/workspace/src/a.ts' } })

    const promise = grepFilesWithType()
    await new Promise((r) => setTimeout(r, 10))
    quickPickAcceptHandler?.()
    quickPickHideHandler?.()
    await promise

    expect(sendCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({ in_grep: true }),
      undefined,
      '/mock/workspace',
    )
  })

  it('shows error when no workspace folder is open', async () => {
    ;(vscode.workspace as any).workspaceFolders = undefined

    await findFilesWithType()

    expect(showErrorMessageMock).toHaveBeenCalledWith(
      'fff-gpui: type-filtered search requires an open workspace folder.',
    )
  })

  it('shows info message when rg finds no files', async () => {
    execFileMock.mockImplementation(
      (_file: string, _args: string[], _options: any, callback: any) => {
        callback(new Error('no matches'), null)
      },
    )

    const promise = findFilesWithType()
    await new Promise((r) => setTimeout(r, 10))
    quickPickAcceptHandler?.()
    quickPickHideHandler?.()
    await promise

    expect(showInformationMessageMock).toHaveBeenCalledWith(
      expect.stringContaining('No files found for type'),
    )
    expect(sendCommandMock).not.toHaveBeenCalled()
  })
})
