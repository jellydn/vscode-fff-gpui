import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  showInformationMessageMock,
  showWarningMessageMock,
  showErrorMessageMock,
  showQuickPickMock,
  sendTextMock,
  showMock,
  getConfigMock,
  trustState,
} = vi.hoisted(() => ({
  showInformationMessageMock: vi.fn(),
  showWarningMessageMock: vi.fn(),
  showErrorMessageMock: vi.fn(),
  showQuickPickMock: vi.fn(),
  sendTextMock: vi.fn(),
  showMock: vi.fn(),
  getConfigMock: vi.fn(),
  trustState: { isTrusted: true },
}))

vi.mock('vscode', () => ({
  window: {
    showInformationMessage: showInformationMessageMock,
    showWarningMessage: showWarningMessageMock,
    showErrorMessage: showErrorMessageMock,
    showQuickPick: showQuickPickMock,
    createTerminal: () => ({
      show: showMock,
      sendText: sendTextMock,
      dispose: vi.fn(),
    }),
  },
  workspace: {
    getConfiguration: getConfigMock,
    get isTrusted() {
      return trustState.isTrusted
    },
  },
}))

import { runCustomTask } from '../src/commands/runCustomTask'

describe('runCustomTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trustState.isTrusted = true
  })

  describe('workspace trust', () => {
    it('refuses to run in an untrusted workspace', async () => {
      trustState.isTrusted = false

      await runCustomTask()

      expect(showErrorMessageMock).toHaveBeenCalledWith(
        'fff-gpui: Custom tasks are disabled in untrusted workspaces. Trust this workspace to enable them.',
      )
    })
  })

  describe('task validation', () => {
    it('shows info message when no custom tasks are configured', async () => {
      getConfigMock.mockReturnValue({
        get: vi.fn().mockReturnValue([]),
      })

      await runCustomTask()

      expect(showInformationMessageMock).toHaveBeenCalledWith(
        'No custom tasks configured. Add them in settings: fff-gpui.customTasks.',
      )
    })

    it('filters malformed entries and warns', async () => {
      const raw = [
        { label: 'Valid', command: 'echo ok' },
        { label: 123 }, // missing command
        { command: 'echo bad' }, // missing label
        null, // not an object
        { label: 'Also Valid', command: 'echo two' },
      ]
      getConfigMock.mockReturnValue({
        get: vi.fn().mockReturnValue(raw),
      })
      showQuickPickMock.mockResolvedValue(undefined) // cancel

      await runCustomTask()

      expect(showWarningMessageMock).toHaveBeenCalledWith(
        'fff-gpui: 3 custom task(s) ignored — each must have a "label" (string) and "command" (string).',
      )
      // Only valid tasks appear in QuickPick
      expect(showQuickPickMock).toHaveBeenCalledWith(['Valid', 'Also Valid'], expect.anything())
    })
  })

  describe('confirmation modal', () => {
    it('runs the selected task after confirmation', async () => {
      const tasks = [
        { label: 'Build', command: 'npm run build' },
        { label: 'Test', command: 'npm test' },
      ]
      getConfigMock.mockReturnValue({
        get: vi.fn().mockReturnValue(tasks),
      })
      showQuickPickMock.mockResolvedValue('Build')
      showWarningMessageMock.mockResolvedValue('Run')

      await runCustomTask()

      expect(showWarningMessageMock).toHaveBeenCalledWith(
        'Run "npm run build"?',
        { modal: true },
        'Run',
      )
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

    it('does nothing when user cancels confirmation modal', async () => {
      const tasks = [{ label: 'Build', command: 'npm run build' }]
      getConfigMock.mockReturnValue({
        get: vi.fn().mockReturnValue(tasks),
      })
      showQuickPickMock.mockResolvedValue('Build')
      showWarningMessageMock.mockResolvedValue(undefined) // cancelled

      await runCustomTask()

      expect(showMock).not.toHaveBeenCalled()
      expect(sendTextMock).not.toHaveBeenCalled()
    })
  })
})
