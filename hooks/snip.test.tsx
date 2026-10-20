import { expect, test } from 'claude-code/testing'

// The overlay and the key sent to the terminal are Windows' own, checked in a live
// session; these hold where the Clip button is drawn, what a press runs, and that the
// thumbnails' band still draws beneath it. Each pill is a Client (pill.tsx) that presses
// on the left button going down, so a press here is a pointer down in its region.

const BAND = {
  plugin: 'paste-preview',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

type On = Parameters<Parameters<typeof test>[1]>[1]

const onOs = (on: On, os: string | undefined) => on('env.get', ($, e) => ({ value: e.name === 'OS' ? os : undefined }))
const engine = (on: On) =>
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text key="engine">engine</Text>
  })

test('on Windows the band draws the Clip button above what is beneath', async ($, on) => {
  onOs(on, 'Windows_NT')
  engine(on)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Client', key: 'snip' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await band.unmount()
})

test('elsewhere the band has no Clip button', async ($, on) => {
  onOs(on, undefined)
  engine(on)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Client', key: 'snip' })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await band.unmount()
})

test('a press runs the snip script once through PowerShell', async ($, on) => {
  const runs: string[][] = []
  onOs(on, 'Windows_NT')
  engine(on)
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: 'PASTED\r\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: 'snip' })
  await new Promise(resolve => setTimeout(resolve, 50))
  const snips = runs.filter(argv => argv.at(-1)?.endsWith('/scripts/snip.ps1'))
  expect(snips.length).toBe(1)
  expect(snips[0]?.[0]).toBe('powershell.exe')
  await band.unmount()
})

// #1 in the box: the thumbnails' band draws its row, and the Clip button sits above it.
const SHOT = { n: 1, file: '/p/1.png', thumb: '/p/1.thumb.png', gen: 0, width: 1600, height: 900, isEdited: false, ratio: 16 / 9 }
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

test('with an image in the box both the Clip button and the thumbnail row are drawn', async ($, on) => {
  const state: Record<string, unknown> = { shots: [SHOT], inBox: [1] }
  onOs(on, 'Windows_NT')
  engine(on)
  on('state.get', ($, e) => ({ value: { value: state[e.key], version: 1 } }))
  on('fs.read', () => ({ value: { base64: PIXEL } }))
  const band = await $.ui.mount({ ...BAND, surface: 'terminal', viewport: { columns: 105, rows: 46, isFullscreen: true } })
  expect(await band.find({ type: 'Client', key: 'snip' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /Image #1/ })).toBeDefined()
  await band.unmount()
})

test('during a survey the band is left to the engine', async ($, on) => {
  onOs(on, 'Windows_NT')
  engine(on)
  const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: 'engine' })).toBeDefined()
  expect(await band.find({ type: 'Client', key: 'snip' })).toBeUndefined()
  await band.unmount()
})

test('the File button sits beside the Clip button on Windows', async ($, on) => {
  onOs(on, 'Windows_NT')
  engine(on)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Client', key: 'attach' })).toBeDefined()
  await band.unmount()
})

test('a File press runs the attach script once and types nothing itself', async ($, on) => {
  const runs: string[][] = []
  const fills: string[] = []
  onOs(on, 'Windows_NT')
  engine(on)
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: 'PASTED\r\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: 'attach' })
  await new Promise(resolve => setTimeout(resolve, 50))
  const attaches = runs.filter(argv => argv.at(-1)?.endsWith('/scripts/attach.ps1'))
  expect(attaches.length).toBe(1)
  expect(attaches[0]?.[0]).toBe('powershell.exe')
  // The paths arrive as a paste from the script's Ctrl+V, never as typed text.
  expect(fills).toEqual([])
  await band.unmount()
})

test('a cancelled dialog runs once and leaves the box alone', async ($, on) => {
  const runs: string[][] = []
  const fills: string[] = []
  onOs(on, 'Windows_NT')
  engine(on)
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    return { value: { exitCode: 2, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: 'attach' })
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(runs.filter(argv => argv.at(-1)?.endsWith('/scripts/attach.ps1')).length).toBe(1)
  expect(fills).toEqual([])
  await band.unmount()
})

// Three pastes of about 1 MiB each: under the one-picture limit, past the engine's 2 MiB
// of Image source per tree together. The band must still draw, buttons and all.
test('three large pictures in the box still draw the band, the buttons included', async ($, on) => {
  const shots = [1, 2, 3].map(n => ({ n, file: `C:/p/${n}.png`, thumb: `C:/p/${n}.png`, gen: 0, width: 1600, height: 900, isEdited: false, ratio: 16 / 9, isLarge: false }))
  const state: Record<string, unknown> = { shots, inBox: [1, 2, 3] }
  onOs(on, 'Windows_NT')
  engine(on)
  on('state.get', ($, e) => ({ value: { value: state[e.key], version: 1 } }))
  // A PNG's first 33 bytes (signature and header), then zeros: about 1 MiB as base64.
  const big = PIXEL.slice(0, 44) + 'A'.repeat(1_000_000 - 44)
  on('fs.read', () => ({ value: { base64: big } }))
  const band = await $.ui.mount({ ...BAND, surface: 'terminal', viewport: { columns: 105, rows: 46, isFullscreen: true } })
  expect(await band.find({ type: 'Client', key: 'attach' })).toBeDefined()
  expect(await band.find({ type: 'Client', key: 'snip' })).toBeDefined()
  const images = await band.findAll({ type: 'Image' })
  expect(images.length).toBe(3)
  const embedded = images.reduce((sum, image) => {
    const source = image.props.source as { png?: string }
    return sum + (source.png?.length ?? 0)
  }, 0)
  expect(embedded).toBeLessThanOrEqual(2 * 1024 * 1024)
  await band.unmount()
})

const PASTED = { exitCode: 0, stdout: 'PASTED\r\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

test('a right-button down on a pill runs nothing', async ($, on) => {
  const runs: string[][] = []
  onOs(on, 'Windows_NT')
  engine(on)
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    return { value: PASTED }
  })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await band.pointer({ type: 'down', x: 1, y: 0, button: 'right', in: 'snip' })
  await band.pointer({ type: 'down', x: 1, y: 0, button: 'right', in: 'attach' })
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(runs.filter(argv => argv.at(-1)?.endsWith('.ps1'))).toEqual([])
  await band.unmount()
})

test('a second down while the snip still runs starts no second one', async ($, on) => {
  const runs: string[][] = []
  let finish: () => void = () => undefined
  onOs(on, 'Windows_NT')
  engine(on)
  on('process.run', async ($, e) => {
    runs.push([...e.argv])
    await new Promise<void>(resolve => (finish = resolve))
    return { value: PASTED }
  })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const down = () => band.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: 'snip' })
  void down()
  await new Promise(resolve => setTimeout(resolve, 50))
  void down()
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(runs.filter(argv => argv.at(-1)?.endsWith('/scripts/snip.ps1')).length).toBe(1)
  finish()
  await new Promise(resolve => setTimeout(resolve, 50))
  await band.unmount()
})

test('a pill is drawn busy while its script runs, and idle again after', async ($, on) => {
  let finish: () => void = () => undefined
  onOs(on, 'Windows_NT')
  engine(on)
  on('process.run', async () => {
    await new Promise<void>(resolve => (finish = resolve))
    return { value: PASTED }
  })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const busy = async (key: string) => ((await band.find({ type: 'Client', key }))?.props.props as { busy?: boolean } | undefined)?.busy
  expect(await busy('attach')).toBe(false)
  void band.pointer({ type: 'down', x: 1, y: 0, button: 'left', in: 'attach' })
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(await busy('attach')).toBe(true)
  expect(await busy('snip')).toBe(false)
  finish()
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(await busy('attach')).toBe(false)
  await band.unmount()
})
