import type { InputHTMLAttributes } from 'react'
import { useId } from 'react'
import { clsx } from '@/lib/clsx'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function TextField({ label, error, id, className, ...props }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-paper/80">
        {label}
      </label>
      <input
        id={fieldId}
        className={clsx(
          'min-h-11 rounded-lg border border-veil-strong bg-veil px-3 py-2.5 text-paper placeholder:text-paper/40 focus:border-gold focus:outline-none',
          error && 'border-danger',
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${fieldId}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
