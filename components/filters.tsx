import type { Period } from "@/lib/dates"
import { inputClass, labelClass, quietButtonClass } from "./ui"

export function Filters({
  path,
  date,
  period,
  showPeriod = false,
  regions,
  regionId = "",
  showRegion = false,
  includeAllRegions = false,
  agent = "",
}: {
  path: string
  date: string
  period?: Period
  showPeriod?: boolean
  regions?: { id: string; name: string }[]
  regionId?: string
  showRegion?: boolean
  includeAllRegions?: boolean
  agent?: string
}) {
  return (
    <form action={path} className="mb-6 flex flex-wrap items-end gap-3">
      {showPeriod ? (
        <label className={labelClass}>
          View
          <select name="period" defaultValue={period} className={inputClass}>
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </label>
      ) : null}
      <label className={labelClass}>
        {period === "week" ? "Week containing" : period === "month" ? "Month containing" : "Date"}
        <input type="date" name="date" defaultValue={date} required className={inputClass} />
      </label>
      {showRegion && regions ? (
        <label className={labelClass}>
          Region
          <select name="region" defaultValue={regionId} className={inputClass}>
            {includeAllRegions ? <option value="">All regions</option> : null}
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {agent ? <input type="hidden" name="agent" value={agent} /> : null}
      <button className={quietButtonClass}>Show</button>
    </form>
  )
}
