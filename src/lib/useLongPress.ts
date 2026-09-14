import { useRef } from 'react'

const LONG_PRESS_MS = 450

/** Fires onLongPress if the pointer stays down past the threshold, otherwise onTap. */
export function useLongPress(onTap: () => void, onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)

  const start = () => {
    fired.current = false
    timer.current = setTimeout(() => {
      fired.current = true
      onLongPress()
    }, LONG_PRESS_MS)
  }

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
  }

  const end = () => {
    clear()
    if (!fired.current) onTap()
  }

  return {
    onPointerDown: start,
    onPointerUp: end,
    onPointerLeave: clear,
    onPointerCancel: clear,
  }
}
