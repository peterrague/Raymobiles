import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Filters } from "@/components/filters"
import { MatchPill } from "@/components/match-pill"
import { DataTable, Notice, PageHeader, Stat, Td, Th } from "@/components/ui"
import { selectedRegion } from "@/lib/desk-region"
import { centralRemaining, stockCell } from "@/lib/books"
import {
  listManufacturers,
  listRegions,
  loadCentralMovements,
  loadReport,
  loadStockMovements,
  movementsForRegion,
  openingsForRegion,
  summariseSales,
} from "@/lib/data"
import { periodRange } from "@/lib/dates"
import { formatKes, formatKesOrDash, formatNumber } from "@/lib/format"
import { deskHref } from "@/lib/href"
import { readFilters } from "@/lib/search"
import { requireUser, seesCash } from "@/lib/session"

export const instant = false
export const metadata: Metadata = { title: "Desk" }

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<p className="text-sm text-ink/60">Loading the desk…</p>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  )
}

async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const filters = await readFilters(searchParams)
  const cash = seesCash(user)
  const regions = user.role === "ADMIN" ? await listRegions() : []
  const regionId =
    user.role === "ADMIN" ? await selectedRegion(filters.region, regions) : (user.regionId ?? "")
  const region = regions.find((item) => item.id === regionId)
  if (user.role === "SALES_LEAD" && !user.regionId) {
    return <Notice>You are not assigned to a region yet.</Notice>
  }
  const report = await loadReport({
    start: filters.date,
    end: filters.date,
    regionId: user.role === "SALES_AGENT" ? undefined : regionId || undefined,
    agentId: user.role === "SALES_AGENT" ? user.id : undefined,
    includeCash: cash,
  })
  const summary = summariseSales(report.sales)

  return (
    <>
      <PageHeader
        title={
          user.role === "SALES_AGENT" ? "Your sales" : region ? `${region.name} desk` : "Today’s desk"
        }
        lede={
          user.role === "SALES_AGENT"
            ? "Phones you have recorded, by supplier. Deposit prices and cash stay with your sales lead."
            : "Units sold, expected deposits, and whether the cash sent matches the cash received. Choose Mombasa or Nyandarua to switch the desk."
        }
      />
      {user.role === "ADMIN" ? (
        <Filters path="/dashboard" date={filters.date} regions={regions} regionId={regionId} showRegion />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Phones sold" value={formatNumber(summary.units)} hint={filters.date} />
        {cash ? (
          <Stat
            label="Expected deposits"
            value={formatKes(summary.deposits.expected)}
            hint={summary.deposits.incomplete ? "A price is missing for part of this." : "Quantity times today’s deposit"}
          />
        ) : null}
        {cash ? (
          <Stat
            label="Cash used"
            value={formatKesOrDash(expenditure(report.cash))}
            hint="Starting cash minus closing balance"
          />
        ) : null}
      </div>

      {user.role === "ADMIN" ? <AdminStock /> : null}
      {user.role === "SALES_LEAD" && user.regionId ? (
        <LeadStock regionId={user.regionId} date={filters.date} />
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold">By supplier</h2>
        {summary.manufacturers.length === 0 ? (
          <Notice>No sales recorded for this date.</Notice>
        ) : (
          <DataTable caption="Sales by supplier">
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
                  {cash ? (
                    <Td align="right">
                      {formatKes(row.deposits.expected)}
                      {row.deposits.incomplete ? " · price missing" : ""}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </section>

      {cash && user.role !== "SALES_AGENT" ? (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold">Cash sent and received</h2>
          {report.cash.length === 0 ? (
            <Notice>No cash has been logged for this date.</Notice>
          ) : (
            <DataTable caption="Cash comparison">
              <thead>
                <tr>
                <Th>Region</Th>
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
                    <Td>{row.regionName}</Td>
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
          )}
          <p className="mt-3 text-sm">
            <Link className="font-semibold text-pine underline-offset-2 hover:underline" href={deskHref("/cash", { date: filters.date, region: regionId })}>
              Open the cash book
            </Link>
          </p>
        </section>
      ) : null}

      {user.role !== "SALES_AGENT" && summary.agents.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold">By person</h2>
          <DataTable caption="Sales by person">
            <thead>
              <tr>
                <Th>Name</Th>
                {user.role === "ADMIN" ? <Th>Region</Th> : null}
                <Th align="right">Phones</Th>
                <Th align="right">Expected deposits</Th>
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
                  <Td align="right">{formatKes(agent.deposits.expected)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>
      ) : null}
      <p className="mt-6 text-sm text-ink/60">
        Weekly and monthly figures are on{" "}
        <Link className="font-semibold text-pine hover:underline" href={deskHref("/reports", { date: filters.date, period: "week", region: regionId })}>
          Reports
        </Link>
        . {periodRange("day", filters.date).start}
      </p>
    </>
  )
}

function expenditure(rows: { recorded: boolean; transaction: number | null }[]) {
  const closed = rows.filter((row) => row.recorded && row.transaction !== null)
  if (closed.length === 0) return null
  return closed.reduce((sum, row) => sum + (row.transaction ?? 0), 0)
}

async function AdminStock() {
  const [manufacturers, central] = await Promise.all([listManufacturers(), loadCentralMovements()])
  const active = manufacturers.filter((manufacturer) => manufacturer.active)
  if (active.length === 0) return <Notice>Add a supplier on the Team page before receiving stock.</Notice>
  return (
    <section className="mt-6 grid gap-3 sm:grid-cols-2">
      {active.map((manufacturer) => {
        const received = central.receipts
          .filter((row) => row.manufacturerId === manufacturer.id)
          .reduce((sum, row) => sum + row.quantity, 0)
        const allocated = central.allocations
          .filter((row) => row.manufacturerId === manufacturer.id)
          .reduce((sum, row) => sum + row.quantity, 0)
        return (
          <Stat
            key={manufacturer.id}
            label={`${manufacturer.name} at centre`}
            value={formatNumber(centralRemaining(received, allocated))}
            hint={`${formatNumber(received)} received · ${formatNumber(allocated)} allocated`}
          />
        )
      })}
    </section>
  )
}

async function LeadStock({ regionId, date }: { regionId: string; date: string }) {
  const [manufacturers, stock, regions] = await Promise.all([
    listManufacturers(),
    loadStockMovements(),
    listRegions(),
  ])
  const region = regions.find((item) => item.id === regionId)
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-base font-semibold">{region?.name ?? "Region"} stock</h2>
      <DataTable caption="Regional stock">
        <thead>
          <tr>
            <Th>Supplier</Th>
            <Th align="right">Opening</Th>
            <Th align="right">Received</Th>
            <Th align="right">Sold</Th>
            <Th align="right">Closing</Th>
          </tr>
        </thead>
        <tbody>
          {manufacturers
            .filter((manufacturer) => manufacturer.active)
            .map((manufacturer) => {
              const cell = stockCell({
                manufacturerId: manufacturer.id,
                date,
                openings: openingsForRegion(stock.openings, regionId),
                allocations: movementsForRegion(stock.allocations, regionId),
                sales: movementsForRegion(stock.sales, regionId),
              })
              return (
                <tr key={manufacturer.id}>
                  <Td>{manufacturer.name}</Td>
                  <Td align="right">{cell.opening === null ? "—" : formatNumber(cell.opening)}</Td>
                  <Td align="right">{formatNumber(cell.received)}</Td>
                  <Td align="right">{formatNumber(cell.sold)}</Td>
                  <Td align="right">{cell.closing === null ? "—" : formatNumber(cell.closing)}</Td>
                </tr>
              )
            })}
        </tbody>
      </DataTable>
    </section>
  )
}
