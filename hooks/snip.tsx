import type { EngineInterface, Register } from 'claude-code'

// The Clip button (Windows only): a pill above the prompt that opens the Windows snip
// overlay (what Win+Shift+S opens). Once the screenshot is on the clipboard the script
// sends Ctrl+V to the terminal, so the prompt takes it as [Image #N] the way a paste by
// hand does, and the paste opens the editor as any paste does. $.prompt.fill takes text
// only, hence the key sent from outside.
//
// The File button beside it opens the Windows "Open" dialog and pastes the chosen files'
// paths the way a drag and drop does (clipboard text, then Ctrl+V): a pasted image path
// becomes [Image #N], any other file stays as its path. A filled-in path ($.prompt.fill)
// would be typed text, which Claude Code never turns into an image.
const COMMAND = 'snip'
const ATTACH = 'attach'
const ORANGE = '#d97757'
const TEAL = '#2a9d8f'

// One snip, one dialog at a time: a second press while either is up does nothing.
let isBusy = false
let isPicking = false
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

// Images the File button pastes are attached as they are, like a chat app's attach: the
// editor stays shut (the band's Edit button still opens it). The paste lands while the
// script still runs, so the window opens before it and closes a moment after it.
const QUIET_AFTER_MS = 5_000
let quietUntil = 0
export function isQuietPaste() {
  return Date.now() < quietUntil
}

async function attach($: EngineInterface) {
  if (isPicking) return
  isPicking = true
  quietUntil = Number.POSITIVE_INFINITY
  let pasted = false
  try {
    const script = `${$.plugin.root}/scripts/attach.ps1`
    const ran = await $.process.run(['powershell.exe', '-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', script], { timeoutMs: 600_000 })
    pasted = ran.stdout.trim() === 'PASTED'
    if (ran.exitCode === 2 || pasted) return
    $.ui.toast(`附加檔案失敗：${(ran.stderr || ran.stdout).trim().slice(0, 120)}`)
  } catch {
    $.ui.toast('附加檔案失敗：PowerShell 跑不起來')
  } finally {
    quietUntil = pasted ? Date.now() + QUIET_AFTER_MS : 0
    isPicking = false
  }
}

// register.tsx's session.start calls this: the /snip command, where the button is drawn.
export async function startSnip($: EngineInterface) {
  if (!(await onWindows($))) return
  await $.command.register({ name: COMMAND, description: '開 Windows 截圖框，截完自動貼進輸入框' })
  await $.command.register({ name: ATTACH, description: '開 Windows 選檔視窗，選好的檔案路徑放進輸入框' })
}

// register.tsx's band hook hands what it drew here: the Clip pill goes above it.
export async function withClip($: EngineInterface, e: Parameters<typeof $.ui.resolve>[0] & { props: { hasSurvey?: boolean } }, below: unknown) {
  if (e.surface !== 'terminal' || e.props.hasSurvey || !(await onWindows($))) return below
  const { Box, Button, Text } = $.ui.resolve(e)

  // A pill: the terminal has no rounded corners, so the two ends are the Powerline
  // half-circle glyphs in the pill's colour (they need a font that carries them).
  const pill = (key: string, label: string, colour: string, press: () => void) => (
    <Button key={key} plain onPress={press}>
      <Text color={colour}>{'\uE0B6'}</Text>
      <Text backgroundColor={colour} color="#ffffff" bold>{label}</Text>
      <Text color={colour}>{'\uE0B4'}</Text>
    </Button>
  )

  // File first, then Clip, each in its own colour so the two read apart at a glance.
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={2}>
        {pill('attach', ' 📎 File ', TEAL, () => void attach($))}
        {pill('snip', ' ✂️ Clip ', ORANGE, () => void snip($))}
      </Box>
      {below}
    </Box>
  )
}

export const registerSnip: Register = on => {
  on('command.run', { command: COMMAND }, async $ => {
    void snip($)

    return { text: '截圖框已開啟，截完會自動貼上' }
  })

  on('command.run', { command: ATTACH }, async $ => {
    void attach($)

    return { text: '選檔視窗已開啟，選好的檔案會放進輸入框' }
  })
}
