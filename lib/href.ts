export function deskHref(path: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  const text = params.toString()
  return text ? `${path}?${text}` : path
}

export function pickId(requested: string, options: { id: string }[], fallback?: string) {
  if (requested && options.some((option) => option.id === requested)) return requested
  if (fallback && options.some((option) => option.id === fallback)) return fallback
  return options[0]?.id ?? ""
}
