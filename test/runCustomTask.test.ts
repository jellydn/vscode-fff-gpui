import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showInformationMessageMock, showQuickPickMock, sendTextMock, showMock, getConfigMock } =
  vi.hoisted(() => ({
    showInformationMessageMock: vi.fn(),
    showQuickPickMock: vi.fn(),
    sendTextMock: vi.fn(),
    showMock: vi.fn(),
    getConfigMock: vi.fn(),
  }))

vi.mock('vscode', () => ({
  window: {
    showInformationMessage: showInformationMessageMock,
    showQuickPick: showQuickPickMock,
    createTerminal: () => ({
      show: showMock,
      sendText: sendTextMock,
      dispose: vi.fn(),
    }),
  },
  workspace: {
    getConfiguration: getConfigMock,
  },
}))

import { runCustomTask } from '../src/commands/runCustomTask'

describe('runCustomTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows info message when no custom tasks are configured', async () => {
    getConfigMock.mockReturnValue({
      get: vi.fn().mockReturnValue([]),
    })

    await runCustomTask()

    expect(showInformationMessageMock).toHaveBeenCalledWith(
      'No custom tasks configured. Add them in settings: fff-gpui.customTasks.',
    )
  })

  it('runs selected task in a terminal', async () => {
    const tasks = [
      { label: 'Build', command: 'npm run build' },
      { label: 'Test', command: 'npm test' },
    ]
    getConfigMock.mockReturnValue({
      get: vi.fn().mockReturnValue(tasks),
    })
    showQuickPickMock.mockResolvedValue('Build')

    await runCustomTask()

    expect(showMock).toHaveBeenCalled()
    expect(sendTextMock).toHaveBeenCalledWith('npm run build')
  })

  it('does nothing when user cancels QuickPick', async () => {
    const tasks = [{ label: 'Build', command: 'npm run build' }]
    getConfigMock.mockReturnValue({
      get: vi.fn().mockReturnValue(tasks),
    })
    showQuickPickMock.mockResolvedValue(undefined)

    await runCustomTask()

    expect(showMock).not.toHaveBeenCalled()
    expect(sendTextMock).not.toHaveBeenCalled()
  })
})
