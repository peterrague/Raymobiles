export const PREVIEW_COOKIE = "batrobas_preview"
export const PREVIEW_EMAIL = "preview@batrobas.local"

export const PREVIEW_ROLES = ["ADMIN", "SALES_LEAD", "SALES_AGENT"] as const
export type PreviewRole = (typeof PREVIEW_ROLES)[number]

const PREVIEW_COOKIE_VALUES: Record<PreviewRole, string> = {
  ADMIN: "admin",
  SALES_LEAD: "lead",
  SALES_AGENT: "agent",
}

export function previewCookieValue(role: PreviewRole) {
  return PREVIEW_COOKIE_VALUES[role]
}

export function previewRoleFromForm(value: string): PreviewRole | null {
  return (PREVIEW_ROLES as readonly string[]).includes(value) ? (value as PreviewRole) : null
}

export function previewRoleFromCookie(value: string | undefined): PreviewRole | null {
  if (value === "admin" || value === "1") return "ADMIN"
  if (value === "lead") return "SALES_LEAD"
  if (value === "agent") return "SALES_AGENT"
  return null
}
