import type { Metadata } from "next"
import { Suspense } from "react"
import { DailySetupWizard } from "@/components/daily-setup"
import { Filters } from "@/components/filters"
import { Notice, PageHeader } from "@/components/ui"
import { stockCell } from "@/lib/books"
import {
  activeLead,
  cashSend,
  dailySetup,
  listManufacturers,
  listRegions,
  listSupplierPhones,
  loadAllocationRows,
  loadStockMovements,
  movementsForRegion,
  openingsForRegion,
} from "@/lib/data"
import { readFilters } from "@/lib/search"
import { requireRole, requireUser } from "@/lib/session"

export const instant = false
export const metadata: Metadata = { title: "Daily setup" }

export default function SetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<p className="text-sm text-ink/60">Loading daily setup…</p>}>
      <Setup searchParams={searchParams} />
    </Suspense>
  )
}

async function Setup({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  requireRole(user, ["ADMIN"])
  const filters = await readFilters(searchParams)
  const [manufacturers, phones, regions, stock, setup, allocationRows] = await Promise.all([
    listManufacturers(),
    listSupplierPhones(),
    listRegions(),
    loadStockMovements(),
    dailySetup(filters.date),
    loadAllocationRows(),
  ])
  const activeIds = manufacturers.filter((supplier) => supplier.active).map((supplier) => supplier.id)
  const links = setup?.allocations ?? []
  const regionRows = await Promise.all(
    regions.map(async (region) => {
      const [lead, sent] = await Promise.all([activeLead(region.id), cashSend(region.id, filters.date)])
      const onHand = activeIds.reduce((sum, supplierId) => {
        return (
          sum +
          stockCell({
            manufacturerId: supplierId,
            date: filters.date,
            openings: openingsForRegion(stock.openings, region.id),
            allocations: movementsForRegion(stock.allocations, region.id),
            sales: movementsForRegion(stock.sales, region.id),
          }).onHand
        )
      }, 0)
      const setupQty = links
        .filter((link) => link.regionId === region.id)
        .reduce((sum, link) => sum + (allocationRows.find((row) => row.id === link.allocationId)?.quantity ?? 0), 0)
      const drafted = setup?.cash.find((row) => row.regionId === region.id)?.amount
      return {
        id: region.id,
        name: region.name,
        remaining: onHand - setupQty,
        leadName: lead?.name ?? null,
        cash: drafted !== undefined ? String(drafted) : sent ? String(sent.amount) : "",
      }
    }),
  )

  return (
    <>
      <PageHeader
        title="Daily setup"
        lede="Update the day’s stock and the cash sent to each sales lead. Type how many received phones go to each region."
      />
      <Filters path="/setup" date={filters.date} />
      {regions.length === 0 ? (
        <Notice>Add Mombasa and Nyandarua before running daily setup.</Notice>
      ) : (
        <DailySetupWizard
          key={filters.date}
          date={filters.date}
          submitted={setup?.status === "submitted"}
          regions={regionRows}
          suppliers={manufacturers
            .filter((supplier) => supplier.active)
            .map((supplier) => ({ id: supplier.id, name: supplier.name, active: supplier.active }))}
          phones={phones.map((phone) => ({
            id: phone.id,
            supplierId: phone.supplierId,
            phoneType: phone.phoneType,
            model: phone.model,
          }))}
          initial={{
            supplierId: setup?.supplierId ?? "",
            phoneId: setup?.phoneId ?? "",
            quantity: setup?.quantity === null || setup?.quantity === undefined ? "" : String(setup.quantity),
            sends: Object.fromEntries(
              regions.map((region) => {
                const saved = setup?.sends.find((row) => row.regionId === region.id)?.quantity
                if (saved !== undefined) return [region.id, String(saved)]
                const allocated = links
                  .filter((link) => link.regionId === region.id)
                  .reduce((sum, link) => sum + (allocationRows.find((row) => row.id === link.allocationId)?.quantity ?? 0), 0)
                return [region.id, allocated > 0 ? String(allocated) : ""]
              }),
            ),
          }}
        />
      )}
    </>
  )
}
