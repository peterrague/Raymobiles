export type Period = "day" | "week" | "month"

export function isISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function weekRange(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = date.getUTCDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  const start = addDays(iso, mondayOffset)
  return { start, end: addDays(start, 6) }
}

export function monthRange(iso: string) {
  const [year, month] = iso.split("-").map(Number)
  const start = `${iso.slice(0, 7)}-01`
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return { start, end }
}

export function periodRange(period: Period, iso: string) {
  if (period === "week") return weekRange(iso)
  if (period === "month") return monthRange(iso)
  return { start: iso, end: iso }
}
