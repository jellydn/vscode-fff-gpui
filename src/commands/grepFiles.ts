import { runPicker } from './runPicker'

export async function grepFiles(): Promise<void> {
  await runPicker({
    inGrep: true,
    statusTip:
      'Tip: type a search pattern (e.g. TODO) — plain text, regex, or fuzzy modes available',
  })
}
