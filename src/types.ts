export interface ServiceCommand {
  cmd: 'open_path' | 'open_one_shot' | 'open_config' | 'toggle_window' | 'quit'
  path?: string
  in_grep?: boolean
}

export interface PickEntry {
  path: string
  line?: number
  column?: number
}

export function isPickEntry(entry: unknown): entry is PickEntry {
  if (!entry || typeof entry !== 'object') return false

  const e = entry as Record<string, unknown>
  if (typeof e.path !== 'string') return false
  if (e.line !== undefined && e.line !== null && typeof e.line !== 'number') return false
  if (e.column !== undefined && e.column !== null && typeof e.column !== 'number') return false

  return true
}

export interface PickResponse {
  paths: PickEntry[]
}

export function isPickResponse(value: unknown): value is PickResponse {
  if (!value || typeof value !== 'object') return false

  const v = value as Record<string, unknown>
  if (!Array.isArray(v.paths)) return false
  if (!v.paths.every(isPickEntry)) return false

  return true
}
