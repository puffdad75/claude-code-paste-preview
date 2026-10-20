import type { ClientModule, ClientSurface } from 'claude-code'

// One pill of the band (File or Clip), drawn as a Client instead of a Button: a Button
// presses on the mouse coming up, and only where the pointer stayed on its cell, so a
// quick click that slides off, or the click that brings the terminal to the front,
// presses nothing. A Client hears the button go down and holds the pointer until it
// comes up, so the press is sent at once and the pill turns busy on the next frame.
export type PillProps = { id: string; label: string; colour: string; busy: boolean }
type PillState = { isOver: boolean; ticks: number; hasClock: boolean }

const GREY = '#6b7280'
// How long the pill stays busy on its own after a press (TICKS x TICK_MS), until the
// hooks module's own busy flag has come back in the props.
const TICK_MS = 100
const TICKS = 8

const Pill: ClientModule<PillProps, PillState> = (props, surface: ClientSurface<PillState>) => {
  const { Box, Text } = surface.elements
  const now = () => surface.state ?? { isOver: false, ticks: 0, hasClock: false }
  // One listener per instance: each call's replaces the last.
  surface.onPointer(e => {
    // Inverted under the pointer, as a Button is (press.tsx draws Edit the same way).
    if (e.type === 'enter' || e.type === 'leave') {
      surface.setState({ ...now(), isOver: e.type === 'enter' })
      return
    }
    if (e.type !== 'down' || e.button !== 'left') return
    // The first press starts the clock that winds the busy look down.
    if (!now().hasClock) {
      surface.every(TICK_MS, () => {
        const state = now()
        if (state.ticks > 0) surface.setState({ ...state, ticks: state.ticks - 1 })
      })
    }
    surface.setState({ ...now(), ticks: TICKS, hasClock: true })
    surface.post({ press: props.id })
  })

  const state = now()
  const isBusy = props.busy || state.ticks > 0
  const colour = isBusy ? GREY : props.colour
  const label = isBusy ? props.label.replace(/^ \S+/u, ' ⏳') : props.label
  // The two ends are the Powerline half-circle glyphs in the pill's colour: the
  // terminal has no rounded corners (they need a font that carries them).
  return (
    <Box flexDirection="row">
      <Text color={colour}>{''}</Text>
      <Text backgroundColor={colour} color="#ffffff" bold inverse={state.isOver && !isBusy}>{label}</Text>
      <Text color={colour}>{''}</Text>
    </Box>
  )
}

export default Pill
