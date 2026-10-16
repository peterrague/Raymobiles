import type { Metadata } from "next"
import { Suspense } from "react"
import { saveOpenings, saveReceipt } from "@/app/actions/stock"
import { ActionForm } from "@/components/action-form"
import { PhoneChoice } from "@/components/phone-choice"
import { Filters } from "@/components/filters"
import { DataTable, Notice, PageHeader, Panel, Stat, Td, Th, inputClass, labelClass } from "@/components/ui"
import { stockCell } from "@/lib/books"
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
import { formatLongDate, formatNumber } from "@/lib/format"
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
        lede="Record the date stock arrives from a supplier. Daily setup sends those phones to the regions, which reduces what is left at the centre."
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
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            {centreCards(central.receipts, allocationRows, phones, regions, manufacturers).map((card) => (
              <Panel key={card.key} title={`${card.supplier} · ${card.item}`}>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Received</dt>
                    <dd className="mt-1">
                      {card.receipts.map((receipt) => (
                        <p key={receipt.id}>
                          {formatLongDate(receipt.date)} · {formatNumber(receipt.quantity)}
                        </p>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Distributed</dt>
                    <dd className="num mt-1 text-base">{formatNumber(card.distributed)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">At centre</dt>
                    <dd className="num mt-1 text-base">{formatNumber(card.remaining)}</dd>
                  </div>
                  {card.regions.length > 0 ? (
                    <div className="col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Regions supplied</dt>
                      <dd className="mt-1">
                        {card.regions.map((region) => (
                          <p key={region.name}>
                            {region.name} · {formatNumber(region.quantity)}
                          </p>
                        ))}
                      </dd>
                    </div>
                  ) : (
                    <p className="col-span-2 text-ink/60">None sent to a region yet.</p>
                  )}
                </dl>
              </Panel>
            ))}
            {central.receipts.length === 0 ? <Notice>No stock has been received from a supplier yet.</Notice> : null}
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
          <div className="mb-6">
            <Panel title="Receive from a supplier">
              <ActionForm action={saveReceipt} submitLabel="Record receipt">
                {phones.filter((phone) => active.some((supplier) => supplier.id === phone.supplierId)).length === 0 ? (
                  <Notice>Add a phone type and model under a supplier on the Team page before recording a receipt.</Notice>
                ) : (
                  <PhoneChoice
                    suppliers={active}
                    typeLabel="Type of phone supplied"
                    phones={phones.filter((phone) => active.some((supplier) => supplier.id === phone.supplierId))}
                  />
                )}
                <label className={labelClass}>
                  Date received
                  <input type="date" name="date" defaultValue={filters.date} className={inputClass} required />
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
        <div className="mt-6">
          <CorrectionList
            title="Recent receipts"
            rows={central.receipts.slice(0, 8).map((row) => ({
              id: row.id,
              manufacturerId: row.manufacturerId,
              phoneId: row.phoneId,
              phoneLabel: phoneLabel(phones, row.phoneId),
              quantity: row.quantity,
              date: row.date,
              notes: row.notes,
            }))}
            manufacturers={manufacturers}
            action={saveReceipt}
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
  action,
}: {
  title: string
  rows: {
    id: string
    regionId?: string
    manufacturerId: string
    phoneId?: string | null
    phoneLabel?: string | null
    quantity: number
    date: string
    notes: string | null
  }[]
  manufacturers: { id: string; name: string; active: boolean }[]
  action: typeof saveReceipt
}) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? <p className="text-sm text-ink/60">Nothing recorded yet.</p> : null}
      <div className="grid gap-3">
        {rows.map((row) => (
          <ActionForm key={row.id} action={action} submitLabel="Update" compact>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="manufacturerId" value={row.manufacturerId} />
            {row.phoneId ? <input type="hidden" name="phoneId" value={row.phoneId} /> : null}
            <p className="w-full text-sm">{row.phoneLabel || manufacturers.find((item) => item.id === row.manufacturerId)?.name}</p>
            <label className={labelClass}>
              Date received
              <input type="date" name="date" defaultValue={row.date} className={inputClass} required />
            </label>
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

function showQty(value: number | null) {
  return value === null ? "—" : formatNumber(value)
}

function phoneLabel(phones: { id: string; phoneType: string; model: string }[], phoneId: string | null) {
  const phone = phones.find((item) => item.id === phoneId)
  return phone ? `${phone.phoneType} · ${phone.model}` : null
}

function centreCards(
  receipts: { id: string; manufacturerId: string; phoneId: string | null; date: string; quantity: number }[],
  allocations: { regionId: string; manufacturerId: string; phoneId: string | null; quantity: number }[],
  phones: { id: string; phoneType: string; model: string }[],
  regions: { id: string; name: string }[],
  manufacturers: { id: string; name: string }[],
) {
  const groups = new Map<string, typeof receipts>()
  for (const receipt of receipts) {
    const key = receipt.phoneId ?? `supplier:${receipt.manufacturerId}`
    const rows = groups.get(key) ?? []
    rows.push(receipt)
    groups.set(key, rows)
  }
  return [...groups.entries()].map(([key, rows]) => {
    const phoneId = rows[0]?.phoneId ?? null
    const supplierId = rows[0]?.manufacturerId ?? ""
    const matching = allocations.filter((row) =>
      phoneId ? row.phoneId === phoneId : row.manufacturerId === supplierId && !row.phoneId,
    )
    const distributed = matching.reduce((sum, row) => sum + row.quantity, 0)
    const received = rows.reduce((sum, row) => sum + row.quantity, 0)
    const byRegion = new Map<string, number>()
    for (const row of matching) {
      const name = regions.find((region) => region.id === row.regionId)?.name ?? "Region"
      byRegion.set(name, (byRegion.get(name) ?? 0) + row.quantity)
    }
    return {
      key,
      supplier: manufacturers.find((item) => item.id === supplierId)?.name ?? "Supplier",
      item: phoneLabel(phones, phoneId) ?? "Phones",
      receipts: [...rows].sort((a, b) => (a.date < b.date ? 1 : -1)),
      distributed,
      remaining: received - distributed,
      regions: [...byRegion.entries()].map(([name, quantity]) => ({ name, quantity })),
    }
  })
}
