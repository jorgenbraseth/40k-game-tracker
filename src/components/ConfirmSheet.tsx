import { Button } from './Button'
import { Sheet } from './Sheet'

/** A destructive action gated behind an explicit confirm tap, so it can't be triggered by an accidental click. */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  pending,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  pending?: boolean
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-paper/70">{message}</p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Never mind
          </Button>
          <Button type="button" variant="danger" fullWidth onClick={onConfirm} disabled={pending}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
