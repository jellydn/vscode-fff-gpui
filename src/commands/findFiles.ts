import { runPicker } from './runPicker'

export async function findFiles(): Promise<void> {
  await runPicker({
    inGrep: false,
    statusTip: 'Tip: type globs like **/*.ts or git:modified in the search bar to filter',
  })
}
