import * as vscode from 'vscode'

let outputChannel: vscode.OutputChannel | undefined

function channel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('fff-gpui')
  }
  return outputChannel
}

export function log(message: string): void {
  channel().appendLine(`[${new Date().toISOString()}] ${message}`)
}

export function disposeLogger(): void {
  outputChannel?.dispose()
  outputChannel = undefined
}
