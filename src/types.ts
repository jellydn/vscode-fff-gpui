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

export interface PickResponse {
  paths: PickEntry[]
}
