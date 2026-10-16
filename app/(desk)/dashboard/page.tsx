import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Filters } from "@/components/filters"
import { RegionSales } from "@/components/region-sales"
import { MatchPill } from "@/components/match-pill"
import { DataTable, Notice, PageHeader, Panel, Stat, Td, Th } from "@/components/ui"
import { stockCell } from "@/lib/books"
import {
  listManufacturers,
  listRegions,
  listSupplierPhones,
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
export const metadata: Metadata = { title: "Dashboard" }

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
  if (user.role === "ADMIN") {
    const regions = await listRegions()
    return (
      <>
        <PageHeader
          title="Today’s desk"
          lede="Total sales, then each region’s sales, remaining phones, and cash sent. Active suppliers are listed below."
        />
        <Filters path="/dashboard" date={filters.date} />
        <AdminOverview date={filters.date} regions={regions} showMoney={cash} />
      </>
    )
  }
  const regionId = user.regionId ?? ""
  if (user.role === "SALES_LEAD" && !regionId) {
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
        title={user.role === "SALES_AGENT" ? "Your sales" : "Today’s desk"}
        lede={
          user.role === "SALES_AGENT"
            ? "Phones you have recorded, by supplier. Deposit prices and cash stay with your sales lead."
            : "Units sold, expected deposits, and whether the cash sent matches the cash received."
        }
      />
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

      {user.role === "SALES_LEAD" && user.regionId ? (
        <LeadStock regionId={user.regionId} date={filters.date} />
      ) : null}

      <div className="mt-6">
        <Panel title="By supplier">
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
        </Panel>
      </div>

      {cash && user.role !== "SALES_AGENT" ? (
        <div className="mt-4">
          <Panel title="Cash sent and received">
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
          </Panel>
        </div>
      ) : null}

      {user.role !== "SALES_AGENT" && summary.agents.length > 0 ? (
        <div className="mt-4">
          <Panel title="By person">
          <DataTable caption="Sales by person">
            <thead>
              <tr>
                <Th>Name</Th>
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
                  <Td align="right">{formatNumber(agent.units)}</Td>
                  <Td align="right">{formatKes(agent.deposits.expected)}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          </Panel>
        </div>
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

async function AdminOverview({
  date,
  regions,
  showMoney,
}: {
  date: string
  regions: { id: string; name: string }[]
  showMoney: boolean
}) {
  const [report, stock, manufacturers, phones] = await Promise.all([
    loadReport({ start: date, end: date, includeCash: showMoney }),
    loadStockMovements(),
    listManufacturers(),
    listSupplierPhones(),
  ])
  const active = manufacturers.filter((supplier) => supplier.active)
  const regionSales = regions.map((region) => {
    const lines = report.sales.filter((sale) => sale.regionId === region.id && sale.quantity > 0)
    const expected = lines.every((sale) => sale.price !== null)
      ? lines.reduce((sum, sale) => sum + sale.quantity * (sale.price ?? 0), 0)
      : null
    return {
      id: region.id,
      name: region.name,
      units: lines.reduce((sum, sale) => sum + sale.quantity, 0),
      expected,
      lines: lines.map((sale) => {
        const phone = phones.find((item) => item.id === sale.phoneId)
        return {
          id: `${sale.agentId}-${sale.phoneId ?? sale.manufacturerId}`,
          person: sale.agentName,
          item: phone ? `${phone.phoneType} · ${phone.model}` : sale.manufacturerName,
          units: sale.quantity,
          expected: sale.price === null ? null : sale.quantity * sale.price,
        }
      }),
    }
  })
  const balances = regions.map((region) => {
    const remaining = active.reduce((sum, supplier) => {
      const cell = stockCell({
        manufacturerId: supplier.id,
        date,
        openings: openingsForRegion(stock.openings, region.id),
        allocations: movementsForRegion(stock.allocations, region.id),
        sales: movementsForRegion(stock.sales, region.id),
      })
      return sum + cell.onHand
    }, 0)
    return { id: region.id, name: region.name, remaining }
  })

  return (
    <div className="grid gap-4">
      <RegionSales
        total={regionSales.reduce((sum, region) => sum + region.units, 0)}
        regions={regionSales}
        showMoney={showMoney}
      />

      <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Stock balance">
        <div className="grid gap-3 sm:grid-cols-2">
          {balances.map((region) => (
            <div key={region.id} className="rounded-lg border border-line bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{region.name}</p>
              <p className="num mt-1 text-xl">{formatNumber(region.remaining)}</p>
              <p className="mt-1 text-xs leading-5 text-ink/60">Remaining phones</p>
            </div>
          ))}
        </div>
      </Panel>

      {showMoney ? (
        <Panel title="Cash sent">
          <div className="grid gap-3">
            {regions.map((region) => {
              const row = report.cash.find((entry) => entry.regionId === region.id)
              return (
                <div key={region.id} className="rounded-lg border border-line bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link className="font-semibold text-pine hover:underline" href={deskHref("/cash", { date, region: region.id })}>
                        {region.name}
                      </Link>
                      <p className="mt-1 text-sm text-ink/70">{row?.leadName ?? "No sales lead"}</p>
                    </div>
                    <MatchPill sent={row?.sent ?? null} received={row?.recorded ? row.received : null} />
                  </div>
                  <p className="num mt-2 text-xl">{formatKesOrDash(row?.sent ?? null)}</p>
                </div>
              )
            })}
          </div>
        </Panel>
      ) : null}
      </div>

      <Panel title="Active suppliers">
          {active.length === 0 ? <Notice>No active supplier yet. Add Jill on the Team page.</Notice> : null}
          <div className="grid gap-3">
            {active.map((supplier) => {
              const models = phones.filter((phone) => phone.supplierId === supplier.id)
              return (
                <div key={supplier.id} className="rounded-lg border border-line bg-white p-3">
                  <p className="font-semibold">{supplier.name}</p>
                  {models.length === 0 ? (
                    <p className="text-sm text-ink/60">No phone models yet.</p>
                  ) : (
                    <ul className="mt-1 text-sm text-ink/80">
                      {models.map((phone) => (
                        <li key={phone.id}>
                          {phone.phoneType} · {phone.model} · {formatNumber(phone.quantity)} supplied
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
      </Panel>
    </div>
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
    <div className="mt-6">
      <Panel title={`${region?.name ?? "Region"} stock`}>
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
      </Panel>
    </div>
  )
}
