import { defineExtension, useCommand } from 'reactive-vscode'
import { findFiles } from './commands/findFiles'
import { grepFiles } from './commands/grepFiles'
import { pickGitStatus } from './commands/pickGitStatus'
import { resumeSearch, saveSearch } from './commands/resumeSearch'
import { runCustomTask } from './commands/runCustomTask'
import { disposeLogger, log } from './logger'

export const { activate, deactivate } = defineExtension(() => {
  log('fff-gpui extension activated')

  useCommand('fff-gpui.findFiles', async () => {
    log('findFiles command invoked')
    saveSearch('files')
    await findFiles()
  })

  useCommand('fff-gpui.grepFiles', async () => {
    log('grepFiles command invoked')
    saveSearch('grep')
    await grepFiles()
  })

  useCommand('fff-gpui.pickFileFromGitStatus', async () => {
    log('pickFileFromGitStatus command invoked')
    saveSearch('git-status')
    await pickGitStatus()
  })

  useCommand('fff-gpui.findTodoFixme', async () => {
    log('findTodoFixme command invoked')
    saveSearch('todo-fixme')
    await grepFiles()
  })

  useCommand('fff-gpui.resumeSearch', async () => {
    log('resumeSearch command invoked')
    await resumeSearch()
  })

  useCommand('fff-gpui.runCustomTask', async () => {
    log('runCustomTask command invoked')
    await runCustomTask()
  })

  return () => {
    log('fff-gpui extension deactivated')
    disposeLogger()
  }
})
