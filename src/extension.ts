import { defineExtension, useCommand } from 'reactive-vscode'
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

  return () => {
    log('fff-gpui extension deactivated')
    disposeLogger()
  }
})
