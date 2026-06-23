import { defineExtension, useCommand } from 'reactive-vscode'
import { findFiles } from './commands/findFiles'
import { findTodoFixme } from './commands/findTodoFixme'
import { grepFiles } from './commands/grepFiles'
import { pickGitStatus } from './commands/pickGitStatus'
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

  useCommand('fff-gpui.pickFileFromGitStatus', async () => {
    log('pickFileFromGitStatus command invoked')
    await pickGitStatus()
  })

  useCommand('fff-gpui.findTodoFixme', async () => {
    log('findTodoFixme command invoked')
    await findTodoFixme()
  })

  return () => {
    log('fff-gpui extension deactivated')
    disposeLogger()
  }
})
