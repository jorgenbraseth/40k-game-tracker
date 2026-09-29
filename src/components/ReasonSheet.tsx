import { useState } from 'react'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { TextAreaField } from './TextField'

/**
 * A bottom sheet asking for a short free-text reason before an action -- contesting a game,
 * invalidating it, dismissing a contest. The draft lives here, not in the caller, and is cleared
 * once the action succeeds; on failure the sheet stays open with the text intact so the user can
 * retry (the mutation's own toast says what went wrong).
 */
export function ReasonSheet({
  open,
  onClose,
  onSubmit,
  title,
  message,
  label,
  placeholder,
  submitLabel,
  required = true,
  danger,
  pending,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<unknown>
  title: string
  message: string
  label: string
  placeholder?: string
  submitLabel: string
  required?: boolean
  danger?: boolean
  pending?: boolean
}) {
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onSubmit(trimmed)
      setReason('')
      onClose()
    } catch {
      // surfaced via the mutation's own toast; keep the sheet open to retry
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-paper/70">{message}</p>
        <TextAreaField
          label={label}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          maxLength={1000}
          required={required}
        />
        <div className="flex gap-3">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Never mind
          </Button>
          <Button
            type="submit"
            variant={danger ? 'danger' : 'primary'}
            fullWidth
            disabled={pending || (required && trimmed.length === 0)}
          >
            {pending ? 'Working…' : submitLabel}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
