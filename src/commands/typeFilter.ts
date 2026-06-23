import * as vscode from 'vscode'

const FILE_TYPES = [
  { label: 'TypeScript (.ts, .tsx)', type: 'ts' },
  { label: 'JavaScript (.js, .jsx)', type: 'js' },
  { label: 'Rust (.rs)', type: 'rust' },
  { label: 'Go (.go)', type: 'go' },
  { label: 'Python (.py)', type: 'py' },
  { label: 'Ruby (.rb)', type: 'ruby' },
  { label: 'CSS (.css)', type: 'css' },
  { label: 'JSON (.json)', type: 'json' },
  { label: 'Markdown (.md)', type: 'md' },
  { label: 'YAML (.yml, .yaml)', type: 'yaml' },
  { label: 'Shell (.sh)', type: 'sh' },
  { label: 'HTML (.html)', type: 'html' },
  { label: 'XML (.xml)', type: 'xml' },
  { label: 'C / C++ (.c, .cpp)', type: 'cpp' },
  { label: 'Java (.java)', type: 'java' },
  { label: 'Kotlin (.kt)', type: 'kotlin' },
  { label: 'Swift (.swift)', type: 'swift' },
  { label: 'Lua (.lua)', type: 'lua' },
  { label: 'Zig (.zig)', type: 'zig' },
]

export async function selectTypeFilter(): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve) => {
    let resolved = false
    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>()
    quickPick.items = FILE_TYPES.map(({ label }) => ({ label }))
    quickPick.placeholder = 'Filter by file type (or Esc to skip)'

    quickPick.onDidAccept(() => {
      const selected = quickPick.selectedItems[0]
      if (!selected) {
        resolved = true
        resolve(undefined)
        quickPick.hide()
        return
      }
      const match = FILE_TYPES.find((ft) => ft.label === selected.label)
      resolved = true
      resolve(match?.type)
      quickPick.hide()
    })

    quickPick.onDidHide(() => {
      if (!resolved) {
        resolve(undefined)
      }
      quickPick.dispose()
    })

    quickPick.show()
  })
}
