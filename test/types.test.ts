import { describe, expect, it } from 'vitest'
import { isPickEntry, isPickResponse } from '../src/types'

describe('isPickEntry', () => {
  it('returns false for null', () => {
    expect(isPickEntry(null)).toBe(false)
  })

  it('returns false for non-objects', () => {
    expect(isPickEntry('string')).toBe(false)
    expect(isPickEntry(42)).toBe(false)
    expect(isPickEntry(true)).toBe(false)
    expect(isPickEntry(undefined)).toBe(false)
  })

  it('returns false when path is missing', () => {
    expect(isPickEntry({})).toBe(false)
    expect(isPickEntry({ line: 1 })).toBe(false)
    expect(isPickEntry({ column: 5 })).toBe(false)
  })

  it('returns false when path is not a string', () => {
    expect(isPickEntry({ path: 123 })).toBe(false)
    expect(isPickEntry({ path: null })).toBe(false)
    expect(isPickEntry({ path: true })).toBe(false)
    expect(isPickEntry({ path: {} })).toBe(false)
  })

  it('returns false when line is present but not a number', () => {
    expect(isPickEntry({ path: '/ok.ts', line: 'not-a-number' })).toBe(false)
    expect(isPickEntry({ path: '/ok.ts', line: true })).toBe(false)
    expect(isPickEntry({ path: '/ok.ts', line: {} })).toBe(false)
  })

  it('returns false when column is present but not a number', () => {
    expect(isPickEntry({ path: '/ok.ts', column: 'bad' })).toBe(false)
    expect(isPickEntry({ path: '/ok.ts', column: false })).toBe(false)
    expect(isPickEntry({ path: '/ok.ts', line: 5, column: {} })).toBe(false)
  })

  it('returns true for a minimal valid entry (path only)', () => {
    expect(isPickEntry({ path: '/tmp/file.ts' })).toBe(true)
  })

  it('returns true for an entry with path and line', () => {
    expect(isPickEntry({ path: '/tmp/file.ts', line: 42 })).toBe(true)
  })

  it('returns true for an entry with path, line, and column', () => {
    expect(isPickEntry({ path: '/tmp/file.ts', line: 10, column: 5 })).toBe(true)
  })

  it('accepts null line (treated as absent)', () => {
    expect(isPickEntry({ path: '/tmp/file.ts', line: null })).toBe(true)
  })

  it('accepts null column (treated as absent)', () => {
    expect(isPickEntry({ path: '/tmp/file.ts', line: 3, column: null })).toBe(true)
  })

  it('accepts line: 0 as valid', () => {
    expect(isPickEntry({ path: '/tmp/file.ts', line: 0 })).toBe(true)
  })
})

describe('isPickResponse', () => {
  it('returns false for null', () => {
    expect(isPickResponse(null)).toBe(false)
  })

  it('returns false for non-objects', () => {
    expect(isPickResponse('string')).toBe(false)
    expect(isPickResponse(42)).toBe(false)
    expect(isPickResponse(undefined)).toBe(false)
  })

  it('returns false when paths is missing', () => {
    expect(isPickResponse({})).toBe(false)
  })

  it('returns false when paths is null', () => {
    expect(isPickResponse({ paths: null })).toBe(false)
  })

  it('returns false when paths is not an array', () => {
    expect(isPickResponse({ paths: 'not-array' })).toBe(false)
    expect(isPickResponse({ paths: 42 })).toBe(false)
    expect(isPickResponse({ paths: {} })).toBe(false)
  })

  it('returns true for an empty paths array', () => {
    expect(isPickResponse({ paths: [] })).toBe(true)
  })

  it('returns true for a single valid entry', () => {
    expect(isPickResponse({ paths: [{ path: '/a.ts' }] })).toBe(true)
  })

  it('returns true for multiple valid entries', () => {
    expect(
      isPickResponse({
        paths: [
          { path: '/a.ts' },
          { path: '/b.ts', line: 5 },
          { path: '/c.ts', line: 10, column: 3 },
        ],
      }),
    ).toBe(true)
  })

  it('returns false when any entry is invalid (non-string path)', () => {
    expect(isPickResponse({ paths: [{ path: '/a.ts' }, { path: 123 }] })).toBe(false)
  })

  it('returns false when any entry is missing path', () => {
    expect(isPickResponse({ paths: [{ path: '/a.ts' }, { line: 1 }] })).toBe(false)
  })

  it('returns false when any entry has non-numeric line', () => {
    expect(isPickResponse({ paths: [{ path: '/a.ts' }, { path: '/b.ts', line: 'bad' }] })).toBe(
      false,
    )
  })
})
