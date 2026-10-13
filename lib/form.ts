import { isISODate } from "./dates"
import { ActionError } from "./errors"

export function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export function parseDate(value: string) {
  if (!isISODate(value)) throw new ActionError("Choose a valid date.")
  return value
}

export function parseWholeNumber(
  value: string,
  label: string,
  options?: { allowEmptyAs?: number; max?: number },
) {
  const max = options?.max ?? 100_000_000
  if (!value) {
    if (options?.allowEmptyAs === undefined) throw new ActionError(`Enter ${label}.`)
    return options.allowEmptyAs
  }
  if (!/^\d+$/.test(value)) throw new ActionError(`${label} must be a whole number.`)
  const amount = Number(value)
  if (!Number.isSafeInteger(amount) || amount > max) {
    throw new ActionError(`${label} is too large.`)
  }
  return amount
}

export function parseNotes(value: string) {
  if (value.length > 500) throw new ActionError("Notes must be 500 characters or fewer.")
  return value || null
}
