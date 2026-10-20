import type { ClientModule, ClientSurface } from 'claude-code'

// One pill of the band (File or Clip), drawn as a Client instead of a Button: a Button
// presses on the mouse coming up, and only where the pointer stayed on its cell, so a
// quick click that slides off, or the click that brings the terminal to the front,
// presses nothing. A Client hears the button go down and holds the pointer until it
// comes up, so the press is sent at once and the pill turns busy on the next frame.
export type PillProps = { id: string; label: string; colour: string; busy: boolean }
type PillState = { ticks: number }

const GREY = '#6b7280'
// How long the pill stays busy on its own after a press (TICKS x TICK_MS), until the
// hooks module's own busy flag has come back in the props.
const TICK_MS = 100
const TICKS = 8

const Pill: ClientModule<PillProps, PillState> = (props, surface: ClientSurface<PillState>) => {
  const { Box, Text } = surface.elements
  // One listener per instance: each call's replaces the last.
  surface.onPointer(e => {
    if (e.type !== 'down' || e.button !== 'left') return
    // The first press starts the clock that winds the busy look down (state is
    // still unset only until then, so it starts once).
    if (surface.state === undefined) {
      surface.every(TICK_MS, () => {
        const ticks = surface.state?.ticks ?? 0
        if (ticks > 0) surface.setState({ ticks: ticks - 1 })
      })
    }
    surface.setState({ ticks: TICKS })
    surface.post({ press: props.id })
  })

  const isBusy = props.busy || (surface.state?.ticks ?? 0) > 0
  const colour = isBusy ? GREY : props.colour
  const label = isBusy ? props.label.replace(/^ \S+/u, ' ⏳') : props.label
  // The two ends are the Powerline half-circle glyphs in the pill's colour: the
  // terminal has no rounded corners (they need a font that carries them).
  return (
    <Box flexDirection="row">
      <Text color={colour}>{''}</Text>
      <Text backgroundColor={colour} color="#ffffff" bold>{label}</Text>
      <Text color={colour}>{''}</Text>
    </Box>
  )
}

export default Pill
