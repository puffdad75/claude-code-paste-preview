import { expect, test } from 'claude-code/testing'

// The overlay and the key sent to the terminal are Windows' own, checked in a live
// session; these hold where the Clip button is drawn, what a press runs, and that the
// thumbnails' band still draws beneath it.

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
  expect(await band.find({ type: 'Button', key: 'snip' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await band.unmount()
})

test('elsewhere the band has no Clip button', async ($, on) => {
  onOs(on, undefined)
  engine(on)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Button', key: 'snip' })).toBeUndefined()
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
  await band.press({ key: 'snip' })
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
  expect(await band.find({ type: 'Button', key: 'snip' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /Image #1/ })).toBeDefined()
  await band.unmount()
})

test('during a survey the band is left to the engine', async ($, on) => {
  onOs(on, 'Windows_NT')
  engine(on)
  const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: 'engine' })).toBeDefined()
  expect(await band.find({ type: 'Button', key: 'snip' })).toBeUndefined()
  await band.unmount()
})

test('the File button sits beside the Clip button on Windows', async ($, on) => {
  onOs(on, 'Windows_NT')
  engine(on)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Button', key: 'attach' })).toBeDefined()
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
  await band.press({ key: 'attach' })
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
  await band.press({ key: 'attach' })
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(runs.filter(argv => argv.at(-1)?.endsWith('/scripts/attach.ps1')).length).toBe(1)
  expect(fills).toEqual([])
  await band.unmount()
})
