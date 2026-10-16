"use client"

import { useState } from "react"
import { DataTable, Td, Th, inputClass, labelClass } from "@/components/ui"
import { formatKes, formatNumber } from "@/lib/format"

export function RegionSales({
  total,
  regions,
  showMoney,
}: {
  total: number
  showMoney: boolean
  regions: {
    id: string
    name: string
    units: number
    expected: number | null
    lines: { id: string; person: string; item: string; units: number; expected: number | null }[]
  }[]
}) {
  const [regionId, setRegionId] = useState(regions[0]?.id ?? "")
  const region = regions.find((item) => item.id === regionId) ?? regions[0]

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Sales</h2>
          <p className="mt-1 text-sm text-ink/70">
            Total sales {formatNumber(total)} phone{total === 1 ? "" : "s"}
          </p>
        </div>
        <label className={labelClass}>
          Region
          <select
            value={region?.id ?? ""}
            className={inputClass}
            onChange={(event) => setRegionId(event.target.value)}
          >
            {regions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {formatNumber(item.units)} sold
              </option>
            ))}
          </select>
        </label>
      </div>
      {!region || region.lines.length === 0 ? (
        <p className="text-sm text-ink/60">No sales in {region?.name ?? "this region"} on this date.</p>
      ) : (
        <DataTable caption={`Sales in ${region.name}`}>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Phone</Th>
              <Th align="right">Sold</Th>
              {showMoney ? <Th align="right">Expected deposits</Th> : null}
            </tr>
          </thead>
          <tbody>
            {region.lines.map((line) => (
              <tr key={line.id}>
                <Td>{line.person}</Td>
                <Td>{line.item}</Td>
                <Td align="right">{formatNumber(line.units)}</Td>
                {showMoney ? <Td align="right">{line.expected === null ? "—" : formatKes(line.expected)}</Td> : null}
              </tr>
            ))}
            <tr>
              <Td>Total</Td>
              <Td>{region.name}</Td>
              <Td align="right">{formatNumber(region.units)}</Td>
              {showMoney ? <Td align="right">{region.expected === null ? "—" : formatKes(region.expected)}</Td> : null}
            </tr>
          </tbody>
        </DataTable>
      )}
    </section>
  )
}
