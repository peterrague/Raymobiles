import type { Metadata } from "next"
import { Suspense } from "react"
import { savePrices } from "@/app/actions/trading"
import { ActionForm } from "@/components/action-form"
import { Filters } from "@/components/filters"
import { Notice, PageHeader, inputClass, labelClass } from "@/components/ui"
import { dayPrices, listManufacturers, listRegions, listSupplierPhones } from "@/lib/data"
import { selectedRegion } from "@/lib/desk-region"
import { formatKes } from "@/lib/format"
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
  const [manufacturers, phones, regions] = await Promise.all([
    listManufacturers(),
    listSupplierPhones(),
    listRegions(),
  ])
  const regionId = user.role === "ADMIN" ? await selectedRegion(filters.region, regions) : (user.regionId ?? "")
  const region = regions.find((item) => item.id === regionId)
  const prices = regionId ? await dayPrices(regionId, filters.date) : []
  const active = manufacturers.filter((manufacturer) => manufacturer.active)
  const lines = phones.filter((phone) => active.some((supplier) => supplier.id === phone.supplierId))

  return (
    <>
      <PageHeader
        title={region ? `${region.name} prices` : "Prices"}
        lede="The admin and the sales lead set the selling price for each phone model. Two models from the same supplier can have different prices. A sale on this date uses that model’s price."
      />
      <Filters path="/prices" date={filters.date} regions={regions} regionId={regionId} showRegion={user.role === "ADMIN"} />
      {!regionId ? <Notice>Choose a region before setting prices.</Notice> : null}
      {regionId && lines.length === 0 ? (
        <Notice>Add a phone type and model under the supplier on the Team page before setting prices.</Notice>
      ) : null}
      {regionId && lines.length > 0 ? (
        <ActionForm action={savePrices} submitLabel="Save prices">
          <input type="hidden" name="regionId" value={regionId} />
          <input type="hidden" name="date" value={filters.date} />
          {active.map((supplier) => {
            const models = lines.filter((phone) => phone.supplierId === supplier.id)
            if (models.length === 0) return null
            return (
              <fieldset key={supplier.id} className="grid gap-3">
                <legend className="text-sm font-semibold">{supplier.name}</legend>
                {models.map((phone) => {
                  const current = prices.find((price) => price.phoneId === phone.id)
                  return (
                    <label key={phone.id} className={labelClass}>
                      {phone.phoneType} · {phone.model}
                      <span className="text-xs font-normal text-ink/55">
                        {current ? `Current price ${formatKes(current.unitPrice)}` : "Not set"}
                      </span>
                      <input
                        name={`price.${phone.id}`}
                        inputMode="numeric"
                        defaultValue={current?.unitPrice ?? ""}
                        placeholder="KES"
                        className={inputClass}
                      />
                    </label>
                  )
                })}
              </fieldset>
            )
          })}
        </ActionForm>
      ) : null}
    </>
  )
}
