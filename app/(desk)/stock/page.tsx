import type { Metadata } from "next"
import { Suspense } from "react"
import { saveAllocation, saveOpenings, saveReceipt } from "@/app/actions/stock"
import { ActionForm } from "@/components/action-form"
import { Filters } from "@/components/filters"
import { DataTable, Notice, PageHeader, Panel, Stat, Td, Th, inputClass, labelClass } from "@/components/ui"
import { centralRemaining, stockCell } from "@/lib/books"
import {
  listManufacturers,
  listRegions,
  listSupplierPhones,
  loadAllocationRows,
  loadCentralMovements,
  loadReport,
  loadStockMovements,
  movementsForRegion,
  openingsForRegion,
  summariseSales,
  type StockMovement,
} from "@/lib/data"
import { selectedRegion } from "@/lib/desk-region"
import { formatNumber } from "@/lib/format"
import { readFilters } from "@/lib/search"
import { requireUser } from "@/lib/session"

export const instant = false
export const metadata: Metadata = { title: "Stock" }

export default function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<p className="text-sm text-ink/60">Loading stock…</p>}>
      <Stock searchParams={searchParams} />
    </Suspense>
  )
}

async function Stock({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const filters = await readFilters(searchParams)
  if (user.role === "SALES_AGENT") return <AgentStock date={filters.date} agentId={user.id} />

  const [manufacturers, phones, regions, stock, central, allocationRows] = await Promise.all([
    listManufacturers(),
    listSupplierPhones(),
    listRegions(),
    loadStockMovements(),
    user.role === "ADMIN" ? loadCentralMovements() : Promise.resolve(null),
    user.role === "ADMIN" ? loadAllocationRows() : Promise.resolve([]),
  ])
  const regionId = user.role === "ADMIN" ? await selectedRegion(filters.region, regions) : (user.regionId ?? "")
  const active = manufacturers.filter((manufacturer) => manufacturer.active)

  return (
    <>
      <PageHeader
        title="Stock"
        lede="Phones are received from a supplier, then allocated to a region. Switch region to open Mombasa or Nyandarua. The lead records opening stock, and sales reduce what is left."
      />
      <Filters
        path="/stock"
        date={filters.date}
        regions={regions}
        regionId={regionId}
        showRegion={user.role === "ADMIN"}
      />
      {active.length === 0 ? <Notice>Add Jill on the Team page, with a phone type, model, and quantity supplied.</Notice> : null}

      {user.role === "ADMIN" && central ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {active.map((manufacturer) => {
              const received = sumQty(central.receipts.filter((row) => row.manufacturerId === manufacturer.id))
              const allocated = sumQty(central.allocations.filter((row) => row.manufacturerId === manufacturer.id))
              return (
                <Stat
                  key={manufacturer.id}
                  label={manufacturer.name}
                  value={`${formatNumber(centralRemaining(received, allocated))} at centre`}
                  hint={`${formatNumber(received)} received · ${formatNumber(allocated)} allocated to regions`}
                />
              )
            })}
          </div>
          <div className="mb-6 grid gap-4">
            {active.map((manufacturer) => {
              const lines = phones.filter((phone) => phone.supplierId === manufacturer.id)
              return (
                <Panel key={manufacturer.id} title={manufacturer.name}>
                  {lines.length === 0 ? (
                    <Notice>Add a phone type, model, and quantity for {manufacturer.name} on the Team page.</Notice>
                  ) : (
                    <DataTable caption={`Phones supplied by ${manufacturer.name}`}>
                      <thead>
                        <tr>
                          <Th>Type of phone</Th>
                          <Th>Model</Th>
                          <Th align="right">Quantity supplied</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((phone) => (
                          <tr key={phone.id}>
                            <Td>{phone.phoneType}</Td>
                            <Td>{phone.model}</Td>
                            <Td align="right">{formatNumber(phone.quantity)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  )}
                </Panel>
              )
            })}
          </div>
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Panel title="Receive from a supplier">
              <ActionForm action={saveReceipt} submitLabel="Record receipt">
                <input type="hidden" name="date" value={filters.date} />
                <label className={labelClass}>
                  Supplier
                  <select name="manufacturerId" className={inputClass} required>
                    {active.map((manufacturer) => (
                      <option key={manufacturer.id} value={manufacturer.id}>
                        {manufacturer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Quantity
                  <input name="quantity" inputMode="numeric" className={inputClass} required />
                </label>
                <label className={labelClass}>
                  Notes
                  <input name="notes" className={inputClass} />
                </label>
              </ActionForm>
            </Panel>
            <Panel title="Allocate to a region">
              <ActionForm action={saveAllocation} submitLabel="Allocate">
                <input type="hidden" name="date" value={filters.date} />
                <label className={labelClass}>
                  Region
                  <select name="regionId" defaultValue={regionId} className={inputClass} required>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Supplier
                  <select name="manufacturerId" className={inputClass} required>
                    {active.map((manufacturer) => (
                      <option key={manufacturer.id} value={manufacturer.id}>
                        {manufacturer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Quantity
                  <input name="quantity" inputMode="numeric" className={inputClass} required />
                </label>
                <label className={labelClass}>
                  Notes
                  <input name="notes" className={inputClass} />
                </label>
              </ActionForm>
            </Panel>
          </div>
        </>
      ) : null}

      {regionId ? (
        <RegionSheet
          title={regions.find((region) => region.id === regionId)?.name ?? "Region"}
          regionId={regionId}
          date={filters.date}
          manufacturers={manufacturers}
          stock={stock}
          canRecordOpening
        />
      ) : (
        <Notice>Add a region before recording stock.</Notice>
      )}

      {user.role === "ADMIN" ? (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold">Every region on {filters.date}</h2>
          <DataTable caption="Stock by region">
            <thead>
              <tr>
                <Th>Region</Th>
                <Th>Supplier</Th>
                <Th align="right">Opening</Th>
                <Th align="right">Received</Th>
                <Th align="right">Sold</Th>
                <Th align="right">Closing</Th>
                <Th align="right">On hand</Th>
              </tr>
            </thead>
            <tbody>
              {regions.flatMap((region) =>
                active.map((manufacturer) => {
                  const cell = cellFor(stock, region.id, manufacturer.id, filters.date)
                  return (
                    <tr key={`${region.id}-${manufacturer.id}`}>
                      <Td>{region.name}</Td>
                      <Td>{manufacturer.name}</Td>
                      <Td align="right">{showQty(cell.opening)}</Td>
                      <Td align="right">{formatNumber(cell.received)}</Td>
                      <Td align="right">{formatNumber(cell.sold)}</Td>
                      <Td align="right">{showQty(cell.closing)}</Td>
                      <Td align="right">{formatNumber(cell.onHand)}</Td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </DataTable>
        </section>
      ) : null}

      {user.role === "ADMIN" && central ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <CorrectionList
            title="Recent receipts"
            rows={central.receipts.slice(0, 8).map((row) => ({
              id: row.id,
              manufacturerId: row.manufacturerId,
              quantity: row.quantity,
              date: row.date,
              notes: row.notes,
            }))}
            manufacturers={manufacturers}
            action={saveReceipt}
          />
          <CorrectionList
            title="Recent allocations"
            rows={allocationRows.slice(0, 8)}
            manufacturers={manufacturers}
            regions={regions}
            action={saveAllocation}
          />
        </div>
      ) : null}
    </>
  )
}

async function AgentStock({ date, agentId }: { date: string; agentId: string }) {
  const history = await loadReport({
    start: "2000-01-01",
    end: date,
    agentId,
    includeCash: false,
  })
  const today = summariseSales(history.sales.filter((line) => line.date === date))
  const total = summariseSales(history.sales)
  return (
    <>
      <PageHeader
        title="Phones you have sold"
        lede="Your own units, by supplier. This does not include cash or deposit amounts."
      />
      <Filters path="/stock" date={date} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Stat label="Sold on this date" value={formatNumber(today.units)} />
        <Stat label="Sold up to this date" value={formatNumber(total.units)} />
      </div>
      <DataTable caption="Phones sold by supplier">
        <thead>
          <tr>
            <Th>Supplier</Th>
            <Th align="right">This date</Th>
            <Th align="right">To date</Th>
          </tr>
        </thead>
        <tbody>
          {total.manufacturers.map((row) => (
            <tr key={row.id}>
              <Td>{row.name}</Td>
              <Td align="right">{formatNumber(today.manufacturers.find((item) => item.id === row.id)?.units ?? 0)}</Td>
              <Td align="right">{formatNumber(row.units)}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {total.manufacturers.length === 0 ? <Notice>You have not recorded a sale yet.</Notice> : null}
    </>
  )
}

function RegionSheet({
  title,
  regionId,
  date,
  manufacturers,
  stock,
  canRecordOpening,
}: {
  title: string
  regionId: string
  date: string
  manufacturers: { id: string; name: string; active: boolean }[]
  stock: { openings: StockMovement[]; allocations: StockMovement[]; sales: StockMovement[] }
  canRecordOpening: boolean
}) {
  const rows = manufacturers
    .map((manufacturer) => ({ manufacturer, cell: cellFor(stock, regionId, manufacturer.id, date) }))
    .filter(
      (row) =>
        row.manufacturer.active ||
        row.cell.opening !== null ||
        row.cell.received > 0 ||
        row.cell.sold > 0 ||
        row.cell.onHand !== 0,
    )

  return (
    <Panel title={`${title} on ${date}`}>
      <DataTable caption={`${title} stock`}>
        <thead>
          <tr>
            <Th>Supplier</Th>
            <Th align="right">Opening</Th>
            <Th align="right">Received</Th>
            <Th align="right">Sold</Th>
            <Th align="right">Closing</Th>
            <Th align="right">On hand</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ manufacturer, cell }) => (
            <tr key={manufacturer.id}>
              <Td>{manufacturer.name}</Td>
              <Td align="right">{showQty(cell.opening)}</Td>
              <Td align="right">{formatNumber(cell.received)}</Td>
              <Td align="right">{formatNumber(cell.sold)}</Td>
              <Td align="right">{showQty(cell.closing)}</Td>
              <Td align="right">{formatNumber(cell.onHand)}</Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {canRecordOpening ? (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">Opening stock</h3>
          <p className="mb-3 text-sm text-ink/70">
            Suggested figures continue from the previous count. A different number is a physical count and is kept in the
            audit log.
          </p>
          <ActionForm action={saveOpenings} submitLabel="Save opening stock">
            <input type="hidden" name="regionId" value={regionId} />
            <input type="hidden" name="date" value={date} />
            {rows
              .filter((row) => row.manufacturer.active)
              .map(({ manufacturer, cell }) => (
                <label key={manufacturer.id} className={labelClass}>
                  {manufacturer.name}
                  <span className="text-xs font-normal text-ink/55">
                    {cell.suggested === null
                      ? "No previous count"
                      : `Suggested ${formatNumber(cell.suggested)}${
                          cell.opening !== null && cell.opening !== cell.suggested
                            ? ` · recorded ${formatNumber(cell.opening)}`
                            : ""
                        }`}
                  </span>
                  <input
                    name={`opening.${manufacturer.id}`}
                    inputMode="numeric"
                    defaultValue={cell.opening ?? cell.suggested ?? 0}
                    className={inputClass}
                    required
                  />
                </label>
              ))}
          </ActionForm>
        </div>
      ) : null}
    </Panel>
  )
}

function CorrectionList({
  title,
  rows,
  manufacturers,
  regions,
  action,
}: {
  title: string
  rows: {
    id: string
    regionId?: string
    manufacturerId: string
    quantity: number
    date: string
    notes: string | null
  }[]
  manufacturers: { id: string; name: string; active: boolean }[]
  regions?: { id: string; name: string }[]
  action: typeof saveReceipt
}) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? <p className="text-sm text-ink/60">Nothing recorded yet.</p> : null}
      <div className="grid gap-3">
        {rows.map((row) => (
          <ActionForm key={row.id} action={action} submitLabel="Update" compact>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="date" value={row.date} />
            <input type="hidden" name="manufacturerId" value={row.manufacturerId} />
            {row.regionId ? <input type="hidden" name="regionId" value={row.regionId} /> : null}
            <p className="w-full text-sm">
              {row.date} · {manufacturers.find((item) => item.id === row.manufacturerId)?.name}
              {row.regionId ? ` · ${regions?.find((item) => item.id === row.regionId)?.name}` : ""}
            </p>
            <label className={labelClass}>
              Quantity
              <input name="quantity" defaultValue={row.quantity} inputMode="numeric" className={inputClass} />
            </label>
            <label className={labelClass}>
              Notes
              <input name="notes" defaultValue={row.notes ?? ""} className={inputClass} />
            </label>
          </ActionForm>
        ))}
      </div>
    </Panel>
  )
}

function cellFor(
  stock: { openings: StockMovement[]; allocations: StockMovement[]; sales: StockMovement[] },
  regionId: string,
  manufacturerId: string,
  date: string,
) {
  return stockCell({
    manufacturerId,
    date,
    openings: openingsForRegion(stock.openings, regionId),
    allocations: movementsForRegion(stock.allocations, regionId),
    sales: movementsForRegion(stock.sales, regionId),
  })
}

function sumQty(rows: { quantity: number }[]) {
  return rows.reduce((sum, row) => sum + row.quantity, 0)
}

function showQty(value: number | null) {
  return value === null ? "—" : formatNumber(value)
}
