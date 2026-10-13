import "server-only"
import { isISODate, type Period } from "./dates"
import { businessToday } from "./today"

export async function readFilters(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
) {
  const params = await searchParams
  const rawDate = first(params.date)
  const date = rawDate && isISODate(rawDate) ? rawDate : await businessToday()
  const rawPeriod = first(params.period)
  const period: Period = rawPeriod === "week" || rawPeriod === "month" ? rawPeriod : "day"
  return {
    date,
    period,
    region: first(params.region) ?? "",
    agent: first(params.agent) ?? "",
  }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
