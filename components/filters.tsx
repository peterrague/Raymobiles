"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { rememberDeskRegion } from "@/app/actions/desk"
import type { Period } from "@/lib/dates"
import { deskHref } from "@/lib/href"
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
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function openRegion(region: string) {
    startTransition(async () => {
      await rememberDeskRegion(region)
      router.push(deskHref(path, { date, period, region, agent }))
    })
  }

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
          <select
            name="region"
            value={regionId}
            disabled={pending}
            className={inputClass}
            onChange={(event) => openRegion(event.target.value)}
          >
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
