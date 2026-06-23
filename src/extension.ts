import { defineExtension, useCommand } from 'reactive-vscode'
import * as vscode from 'vscode'
import { findFiles } from './commands/findFiles'
import { grepFiles } from './commands/grepFiles'
import { disposeLogger, log } from './logger'

export const { activate, deactivate } = defineExtension(() => {
  log('fff-gpui extension activated')

  useCommand('fff-gpui.findFiles', async () => {
    log('findFiles command invoked')
    await findFiles()
  })

  useCommand('fff-gpui.grepFiles', async () => {
    log('grepFiles command invoked')
    await grepFiles()
  })

  // Status bar button for quick access
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
  statusBarItem.text = '$(file-directory) fff-gpui'
  statusBarItem.tooltip = 'fff-gpui: Find Files (Cmd+K Cmd+P)\nClick to open the file picker'
  statusBarItem.command = 'fff-gpui.findFiles'
  statusBarItem.show()

  return () => {
    log('fff-gpui extension deactivated')
    statusBarItem.dispose()
    disposeLogger()
  }
})
