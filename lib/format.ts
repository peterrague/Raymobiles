export function formatKesOrDash(amount: number | null) {
  return amount === null ? "—" : formatKes(amount)
}

export function formatKes(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(amount: number) {
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(amount)
}

export function formatLongDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatRange(start: string, end: string) {
  if (start === end) return formatLongDate(start)
  return `${formatLongDate(start)} – ${formatLongDate(end)}`
}

export function formatWhen(value: Date) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value)
}

export function roleLabel(role: "ADMIN" | "SALES_LEAD" | "SALES_AGENT") {
  if (role === "ADMIN") return "Admin"
  if (role === "SALES_LEAD") return "Sales Lead"
  return "Sales Agent"
}
