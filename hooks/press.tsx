import type { ClientModule, ClientSurface } from 'claude-code'

// A label that presses on the mouse going down, posted to the hooks module as
// { press: id }. A Button presses on the mouse coming up, and only where the pointer
// stayed on its cell: a quick click that slides off, or the click that brings the
// terminal to the front, presses nothing. A Client hears the button go down and holds
// the pointer until it comes up. (A Button drawn inside the Client takes the pointer for
// itself, so the label is plain text: no hotkey, no Enter.)
export type PressProps = { id: string; label: string }
type PressState = { isOver: boolean; ticks: number; hasClock: boolean }

// Inverted under the pointer, as a Button is; grey for a moment after a press
// (TICKS x TICK_MS), as the band's File and Clip pills turn (pill.tsx), so the press
// shows even where the pointer has already left.
const GREY = '#6b7280'
const TICK_MS = 100
const TICKS = 8

const Press: ClientModule<PressProps, PressState> = (props, surface: ClientSurface<PressState>) => {
  const { Text } = surface.elements
  const now = () => surface.state ?? { isOver: false, ticks: 0, hasClock: false }
  // One listener per instance: each call's replaces the last.
  surface.onPointer(e => {
    if (e.type === 'enter' || e.type === 'leave') {
      surface.setState({ ...now(), isOver: e.type === 'enter' })
      return
    }
    if (e.type !== 'down' || e.button !== 'left') return
    // The first press starts the clock that winds the flash down.
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
  const isPressed = state.ticks > 0
  return <Text color={isPressed ? GREY : undefined} inverse={state.isOver && !isPressed}>{props.label}</Text>
}

export default Press
