import { useSyncExternalStore } from 'react'

export interface Toast {
  id: string
  message: string
}

let toasts: Toast[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Fire-and-forget error/status toast, shown at the bottom of the screen for a few seconds. */
export function showToast(message: string) {
  const id = crypto.randomUUID()
  toasts = [...toasts, { id, message }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, 4000)
}

export function useToasts() {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => toasts,
  )
}
