import type { Metadata } from "next"
import { Suspense } from "react"
import { Filters } from "@/components/filters"
import { MatchPill } from "@/components/match-pill"
import { Notice, PageHeader, Panel } from "@/components/ui"
import { activeLead, listRegions, loadReport, type ReportCash } from "@/lib/data"
import { formatKes, formatKesOrDash } from "@/lib/format"
import { readFilters } from "@/lib/search"
import { requireRole, requireUser } from "@/lib/session"

export const instant = false
export const metadata: Metadata = { title: "Cash" }

export default function CashPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<p className="text-sm text-ink/60">Loading cash…</p>}>
      <Cash searchParams={searchParams} />
    </Suspense>
  )
}

async function Cash({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  requireRole(user, ["ADMIN", "SALES_LEAD"])
  const filters = await readFilters(searchParams)
  const regions = await listRegions()
  const visible = user.role === "ADMIN" ? regions : regions.filter((region) => region.id === user.regionId)
  const report = await loadReport({
    start: filters.date,
    end: filters.date,
    regionId: user.role === "ADMIN" ? undefined : user.regionId ?? undefined,
    includeCash: true,
  })
  const leads = await Promise.all(visible.map((region) => activeLead(region.id)))

  return (
    <>
      <PageHeader
        title="Cash"
        lede="Cash movement for each region. Amounts are set in Daily setup, so this page is for viewing only."
      />
      <Filters path="/cash" date={filters.date} />
      {visible.length === 0 ? <Notice>You are not assigned to a region yet.</Notice> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((region, index) => {
          const row = report.cash.find((entry) => entry.regionId === region.id)
          return (
            <CashFlowCard
              key={region.id}
              region={region.name}
              lead={row?.leadName ?? leads[index]?.name ?? "No sales lead"}
              row={row}
            />
          )
        })}
      </div>
    </>
  )
}

function CashFlowCard({ region, lead, row }: { region: string; lead: string; row: ReportCash | undefined }) {
  const recorded = row?.recorded ?? false
  return (
    <Panel title={region}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Figure label="Lead" value={lead} />
        <Figure label="Sent" value={formatKesOrDash(row?.sent ?? null)} />
        <Figure label="Received" value={recorded ? formatKes(row?.received ?? 0) : "—"} />
        <Figure label="Brought forward" value={recorded ? formatKes(row?.broughtForward ?? 0) : "—"} />
        <Figure label="Starting cash" value={recorded ? formatKes(row?.starting ?? 0) : "—"} />
        <Figure label="Closing balance" value={formatKesOrDash(recorded ? (row?.closing ?? null) : null)} />
        <Figure label="Transaction" value={formatKesOrDash(recorded ? (row?.transaction ?? null) : null)} />
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Sent vs received</dt>
          <dd className="mt-1">
            <MatchPill sent={row?.sent ?? null} received={recorded ? (row?.received ?? null) : null} />
          </dd>
        </div>
      </dl>
    </Panel>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</dt>
      <dd className="num mt-1 text-base">{value}</dd>
    </div>
  )
}
