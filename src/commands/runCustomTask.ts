import * as vscode from 'vscode'

interface CustomTask {
  label: string
  command: string
}

function getCustomTasks(): CustomTask[] {
  const raw = vscode.workspace.getConfiguration('fff-gpui').get<unknown[]>('customTasks') || []
  const valid: CustomTask[] = []
  let malformedCount = 0

  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).label === 'string' &&
      typeof (item as Record<string, unknown>).command === 'string'
    ) {
      valid.push(item as CustomTask)
    } else {
      malformedCount++
    }
  }

  if (malformedCount > 0) {
    vscode.window.showWarningMessage(
      `fff-gpui: ${malformedCount} custom task(s) ignored — each must have a "label" (string) and "command" (string).`,
    )
  }

  return valid
}

export async function runCustomTask(): Promise<void> {
  // Reject in untrusted workspaces — custom tasks can run arbitrary shell commands
  if (!vscode.workspace.isTrusted) {
    vscode.window.showErrorMessage(
      'fff-gpui: Custom tasks are disabled in untrusted workspaces. Trust this workspace to enable them.',
    )
    return
  }

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

  // Confirmation modal — show the resolved command before execution
  const confirmed = await vscode.window.showWarningMessage(
    `Run "${task.command}"?`,
    { modal: true },
    'Run',
  )
  if (confirmed !== 'Run') return

  const terminal = vscode.window.createTerminal(`fff-gpui: ${task.label}`)
  terminal.show()
  terminal.sendText(task.command)
}
