import type { Metadata } from "next"
import { Suspense } from "react"
import { Filters } from "@/components/filters"
import { MatchPill } from "@/components/match-pill"
import { DataTable, Notice, PageHeader, Stat, Td, Th } from "@/components/ui"
import { selectedRegion } from "@/lib/desk-region"
import { listRegions, loadReport, summariseSales } from "@/lib/data"
import { periodRange } from "@/lib/dates"
import { formatKes, formatKesOrDash, formatLongDate, formatNumber, formatRange } from "@/lib/format"
import { readFilters } from "@/lib/search"
import { requireUser, seesCash } from "@/lib/session"

export const instant = false
export const metadata: Metadata = { title: "Reports" }

export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<p className="text-sm text-ink/60">Loading reports…</p>}>
      <Reports searchParams={searchParams} />
    </Suspense>
  )
}

async function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const filters = await readFilters(searchParams)
  const cash = seesCash(user)
  const regions = await listRegions()
  if (user.role !== "ADMIN" && !user.regionId && user.role !== "SALES_AGENT") {
    return <Notice>You are not assigned to a region yet.</Notice>
  }
  const regionId = user.role === "ADMIN" ? await selectedRegion(filters.region, regions, { allowAll: true }) : (user.regionId ?? "")
  const range = periodRange(filters.period, filters.date)
  const report = await loadReport({
    start: range.start,
    end: range.end,
    regionId: regionId || undefined,
    agentId: user.role === "SALES_AGENT" ? user.id : undefined,
    includeCash: cash && user.role !== "SALES_AGENT",
  })
  const summary = summariseSales(report.sales)
  const expenditure = report.cash
    .filter((row) => row.recorded && row.transaction !== null)
    .reduce((sum, row) => sum + (row.transaction ?? 0), 0)
  const openDays = report.cash.filter((row) => row.recorded && row.transaction === null)

  return (
    <>
      <PageHeader
        title={filters.period === "day" ? "Daily report" : filters.period === "week" ? "Weekly report" : "Monthly report"}
        lede={`${formatRange(range.start, range.end)}. ${
          cash
            ? "Units, expected deposits, and cash paid out as deposits."
            : "Your phones sold, by supplier. Cash figures are not included."
        }`}
      />
      <Filters
        path="/reports"
        date={filters.date}
        period={filters.period}
        showPeriod
        regions={regions}
        regionId={regionId}
        showRegion={user.role === "ADMIN"}
        includeAllRegions={user.role === "ADMIN"}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Phones sold" value={formatNumber(summary.units)} />
        {cash ? (
          <Stat
            label="Expected deposits"
            value={formatKes(summary.deposits.expected)}
            hint={summary.deposits.incomplete ? "Some sales have no deposit price" : undefined}
          />
        ) : null}
        {cash ? <Stat label="Total cash expenditure" value={formatKes(expenditure)} hint="Sum of daily transactions" /> : null}
      </div>

      <section>
        <h2 className="mb-3 text-base font-semibold">By supplier</h2>
        {summary.manufacturers.length === 0 ? (
          <Notice>No sales in this period.</Notice>
        ) : (
          <DataTable caption="Units by supplier">
            <thead>
              <tr>
                <Th>Supplier</Th>
                <Th align="right">Phones</Th>
                {cash ? <Th align="right">Expected deposits</Th> : null}
              </tr>
            </thead>
            <tbody>
              {summary.manufacturers.map((row) => (
                <tr key={row.id}>
                  <Td>{row.name}</Td>
                  <Td align="right">{formatNumber(row.units)}</Td>
                  {cash ? <Td align="right">{formatKes(row.deposits.expected)}</Td> : null}
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold">{user.role === "SALES_AGENT" ? "Your performance" : "By person"}</h2>
        <DataTable caption="Performance by person">
          <thead>
            <tr>
              <Th>Name</Th>
              {user.role === "ADMIN" ? <Th>Region</Th> : null}
              <Th align="right">Phones</Th>
              {cash ? <Th align="right">Expected deposits</Th> : null}
            </tr>
          </thead>
          <tbody>
            {summary.agents.map((agent) => (
              <tr key={agent.id}>
                <Td>
                  {agent.name}
                  {agent.active ? "" : " · deactivated"}
                </Td>
                {user.role === "ADMIN" ? <Td>{agent.regionName}</Td> : null}
                <Td align="right">{formatNumber(agent.units)}</Td>
                {cash ? <Td align="right">{formatKes(agent.deposits.expected)}</Td> : null}
              </tr>
            ))}
          </tbody>
        </DataTable>
      </section>

      {user.role === "ADMIN" && !regionId ? (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold">By region</h2>
          <DataTable caption="Performance by region">
            <thead>
              <tr>
                <Th>Region</Th>
                <Th align="right">Phones</Th>
                <Th align="right">Expected deposits</Th>
                <Th align="right">Cash expenditure</Th>
              </tr>
            </thead>
            <tbody>
              {summary.regions.map((region) => {
                const spent = report.cash
                  .filter((row) => row.regionId === region.id && row.transaction !== null)
                  .reduce((sum, row) => sum + (row.transaction ?? 0), 0)
                return (
                  <tr key={region.id}>
                    <Td>{region.name}</Td>
                    <Td align="right">{formatNumber(region.units)}</Td>
                    <Td align="right">{formatKes(region.deposits.expected)}</Td>
                    <Td align="right">{formatKes(spent)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </DataTable>
        </section>
      ) : null}

      {cash ? (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold">Cash days</h2>
          <DataTable caption="Daily cash">
            <thead>
              <tr>
                <Th>Date</Th>
                {user.role === "ADMIN" ? <Th>Region</Th> : null}
                <Th>Lead</Th>
                <Th align="right">Sent</Th>
                <Th align="right">Received</Th>
                <Th>Check</Th>
                <Th align="right">Transaction</Th>
              </tr>
            </thead>
            <tbody>
              {report.cash.map((row) => (
                <tr key={`${row.regionId}-${row.date}`}>
                  <Td>{formatLongDate(row.date)}</Td>
                  {user.role === "ADMIN" ? <Td>{row.regionName}</Td> : null}
                  <Td>{row.leadName ?? "No sales lead"}</Td>
                  <Td align="right">{formatKesOrDash(row.sent)}</Td>
                  <Td align="right">{row.recorded ? formatKes(row.received) : "—"}</Td>
                  <Td>
                    <MatchPill sent={row.sent} received={row.recorded ? row.received : null} />
                  </Td>
                  <Td align="right">{formatKesOrDash(row.transaction)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {openDays.length > 0 ? (
            <p className="mt-3 text-sm text-ink/70">
              {openDays.length} day{openDays.length === 1 ? "" : "s"} still need a closing balance, so they are not in the
              expenditure total.
            </p>
          ) : null}
          {report.cash.length === 0 ? <Notice>No cash entries in this period.</Notice> : null}
        </section>
      ) : null}
    </>
  )
}
