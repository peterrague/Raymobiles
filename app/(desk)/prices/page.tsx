import type { Metadata } from "next"
import { Suspense } from "react"
import { savePrices } from "@/app/actions/trading"
import { ActionForm } from "@/components/action-form"
import { Filters } from "@/components/filters"
import { Notice, PageHeader, inputClass, labelClass } from "@/components/ui"
import { dayPrices, listManufacturers, listRegions } from "@/lib/data"
import { formatKes } from "@/lib/format"
import { pickId } from "@/lib/href"
import { readFilters } from "@/lib/search"
import { requireRole, requireUser } from "@/lib/session"

export const instant = false
export const metadata: Metadata = { title: "Prices" }

export default function PricesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<p className="text-sm text-ink/60">Loading prices…</p>}>
      <Prices searchParams={searchParams} />
    </Suspense>
  )
}

async function Prices({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  requireRole(user, ["ADMIN", "SALES_LEAD"])
  const filters = await readFilters(searchParams)
  const [manufacturers, regions] = await Promise.all([listManufacturers(), listRegions()])
  const regionId = user.role === "ADMIN" ? pickId(filters.region, regions) : (user.regionId ?? "")
  const prices = regionId ? await dayPrices(regionId, filters.date) : []
  const active = manufacturers.filter((manufacturer) => manufacturer.active)

  return (
    <>
      <PageHeader
        title="Deposit prices"
        lede="The price is the deposit paid per phone that day. Every sale on this date uses this figure, even if the price changes tomorrow."
      />
      <Filters path="/prices" date={filters.date} regions={regions} regionId={regionId} showRegion={user.role === "ADMIN"} />
      {!regionId ? <Notice>Choose a region before setting prices.</Notice> : null}
      {regionId ? (
        <ActionForm action={savePrices} submitLabel="Save prices">
          <input type="hidden" name="regionId" value={regionId} />
          <input type="hidden" name="date" value={filters.date} />
          {active.map((manufacturer) => {
            const current = prices.find((price) => price.manufacturerId === manufacturer.id)
            return (
              <label key={manufacturer.id} className={labelClass}>
                {manufacturer.name}
                <span className="text-xs font-normal text-ink/55">
                  {current ? `Current deposit ${formatKes(current.unitPrice)}` : "Not set"}
                </span>
                <input
                  name={`price.${manufacturer.id}`}
                  inputMode="numeric"
                  defaultValue={current?.unitPrice ?? ""}
                  placeholder="KES"
                  className={inputClass}
                />
              </label>
            )
          })}
        </ActionForm>
      ) : null}
    </>
  )
}
