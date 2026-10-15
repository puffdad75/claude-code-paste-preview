import type { EngineInterface, Register } from 'claude-code'

// The Clip button (Windows only): a pill above the prompt that opens the Windows snip
// overlay (what Win+Shift+S opens). Once the screenshot is on the clipboard the script
// sends Ctrl+V to the terminal, so the prompt takes it as [Image #N] the way a paste by
// hand does, and the paste opens the editor as any paste does. $.prompt.fill takes text
// only, hence the key sent from outside.
const COMMAND = 'snip'
const ORANGE = '#d97757'

// One snip at a time: a second press while the overlay is up does nothing.
let isBusy = false
// Read once per load: the button is drawn only where the snip overlay exists.
let isWindows: Promise<boolean> | undefined
function onWindows($: EngineInterface) {
  return (isWindows ??= $.env.get('OS').then(os => os === 'Windows_NT').catch(() => false))
}

async function snip($: EngineInterface) {
  if (isBusy) return
  isBusy = true
  try {
    const script = `${$.plugin.root}/scripts/snip.ps1`
    const ran = await $.process.run(['powershell.exe', '-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', script], { timeoutMs: 90_000 })
    const said = ran.stdout.trim()
    if (said === 'PASTED' || said === 'CANCELLED') return
    $.ui.toast(said === 'TIMEOUT' ? '截圖：等太久，已取消' : `截圖失敗：${(ran.stderr || said).trim().slice(0, 120)}`)
  } catch {
    $.ui.toast('截圖失敗：PowerShell 跑不起來')
  } finally {
    isBusy = false
  }
}

// register.tsx's session.start calls this: the /snip command, where the button is drawn.
export async function startSnip($: EngineInterface) {
  if (await onWindows($)) await $.command.register({ name: COMMAND, description: '開 Windows 截圖框，截完自動貼進輸入框' })
}

// register.tsx's band hook hands what it drew here: the Clip pill goes above it.
export async function withClip($: EngineInterface, e: Parameters<typeof $.ui.resolve>[0] & { props: { hasSurvey?: boolean } }, below: unknown) {
  if (e.surface !== 'terminal' || e.props.hasSurvey || !(await onWindows($))) return below
  const { Box, Button, Text } = $.ui.resolve(e)

  // A pill: the terminal has no rounded corners, so the two ends are the Powerline
  // half-circle glyphs in the pill's colour (they need a font that carries them).
  return (
    <Box flexDirection="column">
      <Button key="snip" plain onPress={() => void snip($)}>
        <Text color={ORANGE}>{''}</Text>
        <Text backgroundColor={ORANGE} color="#ffffff" bold> ✂️ Clip </Text>
        <Text color={ORANGE}>{''}</Text>
      </Button>
      {below}
    </Box>
  )
}

export const registerSnip: Register = on => {
  on('command.run', { command: COMMAND }, async $ => {
    void snip($)

    return { text: '截圖框已開啟，截完會自動貼上' }
  })
}
