import * as vscode from 'vscode'

interface CustomTask {
  label: string
  command: string
}

function getCustomTasks(): CustomTask[] {
  return vscode.workspace.getConfiguration('fff-gpui').get<CustomTask[]>('customTasks') || []
}

export async function runCustomTask(): Promise<void> {
  const tasks = getCustomTasks()
  if (tasks.length === 0) {
    vscode.window.showInformationMessage(
      'No custom tasks configured. Add them in settings: fff-gpui.customTasks.',
    )
    return
  }

  const selected = await vscode.window.showQuickPick(
    tasks.map((t) => t.label),
    { placeHolder: 'Select a custom task to run' },
  )
  if (!selected) return

  const task = tasks.find((t) => t.label === selected)
  if (!task) return

  const terminal = vscode.window.createTerminal(`fff-gpui: ${task.label}`)
  terminal.show()
  terminal.sendText(task.command)
}
