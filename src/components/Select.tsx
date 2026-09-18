import type { SelectHTMLAttributes } from 'react'
import { useId } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
}

export function Select({ label, id, children, ...props }: SelectProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-paper/80">
        {label}
      </label>
      <select
        id={fieldId}
        className="min-h-11 rounded-lg border border-veil-strong bg-veil px-3 py-2.5 text-paper focus:border-gold focus:outline-none"
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
