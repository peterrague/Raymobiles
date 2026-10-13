import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { saveSales } from "@/app/actions/trading"
import { ActionForm } from "@/components/action-form"
import { Filters } from "@/components/filters"
import { DataTable, Notice, PageHeader, Td, Th, labelClass, inputClass } from "@/components/ui"
import { dayPrices, daySales, listManufacturers, listRegions, listUsers, regionSellers } from "@/lib/data"
import { formatKes, formatNumber } from "@/lib/format"
import { deskHref, pickId } from "@/lib/href"
import { readFilters } from "@/lib/search"
import { requireUser, seesCash } from "@/lib/session"

export const instant = false
export const metadata: Metadata = { title: "Sales" }

export default function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<p className="text-sm text-ink/60">Loading sales…</p>}>
      <Sales searchParams={searchParams} />
    </Suspense>
  )
}

async function Sales({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const filters = await readFilters(searchParams)
  const [manufacturers, regions, people] = await Promise.all([listManufacturers(), listRegions(), listUsers()])
  const regionId = user.role === "ADMIN" ? pickId(filters.region, regions) : (user.regionId ?? "")
  const sellers = regionId ? await regionSellers(regionId) : []
  const agentId = user.role === "SALES_AGENT" ? user.id : pickId(filters.agent, sellers, user.id)
  const cash = seesCash(user)
  const [prices, sales] = regionId
    ? await Promise.all([
        cash ? dayPrices(regionId, filters.date) : Promise.resolve([]),
        daySales(regionId, filters.date),
      ])
    : [[], []]
  const active = manufacturers.filter((manufacturer) => manufacturer.active)
  const visibleSales = user.role === "SALES_AGENT" ? sales.filter((sale) => sale.agentId === user.id) : sales
  const mine = visibleSales.filter((sale) => sale.agentId === agentId)

  return (
    <>
      <PageHeader
        title="Sales"
        lede={
          cash
            ? "Record phones sold. Expected deposits are the quantity times the deposit price set for that manufacturer and date."
            : "Record how many phones you sold, by manufacturer. Deposit amounts are handled by your sales lead."
        }
      />
      <Filters
        path="/sales"
        date={filters.date}
        regions={regions}
        regionId={regionId}
        showRegion={user.role === "ADMIN"}
        agent={user.role === "SALES_AGENT" ? "" : agentId}
      />
      {!regionId ? <Notice>You are not assigned to a region yet.</Notice> : null}
      {regionId && sellers.length === 0 ? <Notice>This region has no active sales lead or agent yet.</Notice> : null}

      {cash && sellers.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {sellers.map((seller) => (
            <Link
              key={seller.id}
              href={deskHref("/sales", { date: filters.date, region: regionId, agent: seller.id })}
              className={`rounded-full px-3 py-1 text-sm ${
                seller.id === agentId ? "bg-pine text-white" : "bg-mist text-ink"
              }`}
              aria-current={seller.id === agentId ? "true" : undefined}
            >
              {seller.name}
              {seller.role === "SALES_LEAD" ? " · lead" : ""}
            </Link>
          ))}
        </div>
      ) : null}

      {regionId && (user.role === "SALES_AGENT" || agentId) ? (
        <ActionForm action={saveSales} submitLabel="Save sales">
          <input type="hidden" name="date" value={filters.date} />
          <input type="hidden" name="agentId" value={agentId} />
          {active.map((manufacturer) => {
            const quantity = mine.find((sale) => sale.manufacturerId === manufacturer.id)?.quantity ?? 0
            const price = prices.find((row) => row.manufacturerId === manufacturer.id)?.unitPrice ?? null
            return (
              <label key={manufacturer.id} className={labelClass}>
                {manufacturer.name}
                {cash ? (
                  <span className="text-xs font-normal text-ink/55">
                    {price === null ? "Deposit price not set" : `${formatKes(price)} deposit · ${formatKes(quantity * price)} expected`}
                  </span>
                ) : null}
                <input
                  name={`qty.${manufacturer.id}`}
                  inputMode="numeric"
                  defaultValue={quantity || ""}
                  placeholder="0"
                  className={inputClass}
                />
              </label>
            )
          })}
        </ActionForm>
      ) : null}

      {cash && regionId ? (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold">Region sales</h2>
          <DataTable caption="Sales in the region">
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Manufacturer</Th>
                <Th align="right">Phones</Th>
                <Th align="right">Deposit</Th>
                <Th align="right">Expected</Th>
              </tr>
            </thead>
            <tbody>
              {visibleSales
                .filter((sale) => sale.quantity > 0)
                .map((sale) => {
                  const price = prices.find((row) => row.manufacturerId === sale.manufacturerId)?.unitPrice ?? null
                  const seller = people.find((person) => person.id === sale.agentId)
                  return (
                    <tr key={sale.id}>
                      <Td>{seller?.name ?? "Former user"}</Td>
                      <Td>{manufacturers.find((item) => item.id === sale.manufacturerId)?.name}</Td>
                      <Td align="right">{formatNumber(sale.quantity)}</Td>
                      <Td align="right">{price === null ? "—" : formatKes(price)}</Td>
                      <Td align="right">{price === null ? "—" : formatKes(price * sale.quantity)}</Td>
                    </tr>
                  )
                })}
            </tbody>
          </DataTable>
          {visibleSales.every((sale) => sale.quantity === 0) ? <Notice>No phones recorded for this date yet.</Notice> : null}
        </section>
      ) : null}
    </>
  )
}
