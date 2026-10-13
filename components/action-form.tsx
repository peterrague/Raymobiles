"use client"

import { useActionState, type ReactNode } from "react"
import type { ActionState } from "@/lib/errors"
import { buttonClass } from "./ui"

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  compact = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  children: ReactNode
  submitLabel?: string
  compact?: boolean
}) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form action={formAction} className={compact ? "flex flex-wrap items-end gap-2" : "grid gap-3"}>
      {children}
      {state.error ? (
        <p className="w-full text-sm text-clay" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="w-full text-sm text-moss">Saved.</p> : null}
      <button className={buttonClass} disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  )
}
