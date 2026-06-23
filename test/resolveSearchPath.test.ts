import { describe, expect, it } from 'vitest'
import type { SearchContext } from '../src/commands/resolveSearchPath'
import { resolveSearchTarget } from '../src/commands/resolveSearchPath'

describe('resolveSearchTarget', () => {
  it('returns the first workspace folder path when available', () => {
    const ctx: SearchContext = {
      workspaceFolders: [{ uri: { fsPath: '/home/project' } }],
      activeEditor: undefined,
      homedir: '/home/user',
    }

    expect(resolveSearchTarget(ctx)).toBe('/home/project')
  })

  it('falls back to active editor directory when no workspace folder', () => {
    const ctx: SearchContext = {
      workspaceFolders: undefined,
      activeEditor: {
        document: {
          uri: { fsPath: '/home/project/src/index.ts', scheme: 'file' },
        },
      },
      homedir: '/home/user',
    }

    expect(resolveSearchTarget(ctx)).toBe('/home/project/src')
  })

  it('falls back to homedir when no workspace and no active editor', () => {
    const ctx: SearchContext = {
      workspaceFolders: undefined,
      activeEditor: undefined,
      homedir: '/home/user',
    }

    expect(resolveSearchTarget(ctx)).toBe('/home/user')
  })

  it('falls back to homedir when active editor has non-file scheme', () => {
    const ctx: SearchContext = {
      workspaceFolders: undefined,
      activeEditor: {
        document: {
          uri: { fsPath: '/virtual/doc', scheme: 'untitled' },
        },
      },
      homedir: '/home/user',
    }

    expect(resolveSearchTarget(ctx)).toBe('/home/user')
  })

  it('uses the first workspace folder even when multiple exist', () => {
    const ctx: SearchContext = {
      workspaceFolders: [
        { uri: { fsPath: '/home/primary' } },
        { uri: { fsPath: '/home/secondary' } },
      ],
      activeEditor: undefined,
      homedir: '/home/user',
    }

    expect(resolveSearchTarget(ctx)).toBe('/home/primary')
  })

  it('prefers workspace folder over active editor when both are available', () => {
    const ctx: SearchContext = {
      workspaceFolders: [{ uri: { fsPath: '/home/workspace' } }],
      activeEditor: {
        document: {
          uri: { fsPath: '/some/other/file.ts', scheme: 'file' },
        },
      },
      homedir: '/home/user',
    }

    expect(resolveSearchTarget(ctx)).toBe('/home/workspace')
  })
})
