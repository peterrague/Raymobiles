import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { saveCashDay, saveCashSent } from "@/app/actions/cash"
import { ActionForm } from "@/components/action-form"
import { Filters } from "@/components/filters"
import { MatchPill } from "@/components/match-pill"
import { DataTable, Notice, PageHeader, Panel, Stat, Td, Th, inputClass, labelClass } from "@/components/ui"
import { depositGap, startingCash, transactionAmount } from "@/lib/books"
import {
  cashDay,
  cashSend,
  listRegions,
  loadReport,
  previousCashDay,
  summariseSales,
} from "@/lib/data"
import { formatKes, formatKesOrDash, formatNumber } from "@/lib/format"
import { deskHref, pickId } from "@/lib/href"
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
  const regionId = user.role === "ADMIN" ? pickId(filters.region, regions) : (user.regionId ?? "")
  const region = regions.find((item) => item.id === regionId)
  const [day, previous, sent, report, allRegions] = await Promise.all([
    regionId ? cashDay(regionId, filters.date) : Promise.resolve(null),
    regionId ? previousCashDay(regionId, filters.date) : Promise.resolve(null),
    regionId ? cashSend(regionId, filters.date) : Promise.resolve(null),
    regionId
      ? loadReport({ start: filters.date, end: filters.date, regionId, includeCash: true })
      : Promise.resolve({ sales: [], cash: [] }),
    user.role === "ADMIN"
      ? loadReport({ start: filters.date, end: filters.date, includeCash: true })
      : Promise.resolve(null),
  ])
  const summary = summariseSales(report.sales)
  const broughtForward = previous?.closingBalance ?? day?.balanceBroughtForward ?? null
  const lockedForward = previous?.closingBalance !== null && previous?.closingBalance !== undefined
  const starting = day ? startingCash(day.balanceBroughtForward, day.cashReceived) : null
  const transaction =
    day && day.closingBalance !== null ? transactionAmount(startingCash(day.balanceBroughtForward, day.cashReceived), day.closingBalance) : null
  const gap = transaction === null ? null : depositGap(transaction, summary.deposits.expected)
  const previousOpen = previous && previous.closingBalance === null

  return (
    <>
      <PageHeader
        title="Cash"
        lede="This is working cash for customer deposits, not income. Starting cash is the balance brought forward plus cash received. The transaction is starting cash minus the closing balance."
      />
      <Filters path="/cash" date={filters.date} regions={regions} regionId={regionId} showRegion={user.role === "ADMIN"} />
      {previousOpen ? (
        <Notice tone="warn">
          {previous.cashDate} has no closing balance.{" "}
          <Link className="font-semibold underline" href={deskHref("/cash", { date: previous.cashDate, region: regionId })}>
            Close that day
          </Link>{" "}
          before recording {filters.date}.
        </Notice>
      ) : null}

      {region ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Balance brought forward" value={formatKesOrDash(broughtForward)} hint={lockedForward ? `From ${previous?.cashDate}` : "Enter this on the region’s first day"} />
          <Stat label="Cash received" value={day ? formatKes(day.cashReceived) : "—"} hint="The figure the lead records" />
          <Stat label="Starting cash" value={formatKesOrDash(starting)} />
          <Stat label="Closing balance" value={formatKesOrDash(day?.closingBalance ?? null)} hint="Carries into the next day" />
          <Stat label="Transaction" value={formatKesOrDash(transaction)} hint="Cash used for deposits" />
          <Stat
            label="Expected deposits"
            value={formatKes(summary.deposits.expected)}
            hint={summary.deposits.incomplete ? "A deposit price is missing" : `${formatNumber(summary.units)} phones`}
          />
          <Stat
            label="Cash used vs expected"
            value={gap === null ? "—" : gap === 0 ? "Match" : formatKes(gap)}
            hint="Transaction minus expected deposits"
          />
          <div className="rounded-lg border border-line bg-panel px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Sent vs received</p>
            <div className="mt-2">
              <MatchPill sent={sent?.amount ?? null} received={day ? day.cashReceived : null} />
            </div>
            <p className="mt-2 text-xs leading-5 text-ink/60">
              Admin sent {formatKesOrDash(sent?.amount ?? null)}. The books use the cash the lead recorded.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {region && !previousOpen ? (
          <Panel title={`${region.name} cash book`}>
            <ActionForm action={saveCashDay} submitLabel="Save cash day">
              <input type="hidden" name="regionId" value={region.id} />
              <input type="hidden" name="date" value={filters.date} />
              {lockedForward ? (
                <p className="text-sm">Balance brought forward is {formatKes(previous?.closingBalance ?? 0)}, carried from the previous closing balance.</p>
              ) : (
                <label className={labelClass}>
                  Balance brought forward
                  <input
                    name="broughtForward"
                    inputMode="numeric"
                    defaultValue={day?.balanceBroughtForward ?? ""}
                    className={inputClass}
                    required
                  />
                </label>
              )}
              <label className={labelClass}>
                Cash received
                <input
                  name="cashReceived"
                  inputMode="numeric"
                  defaultValue={day?.cashReceived ?? ""}
                  className={inputClass}
                  required
                />
              </label>
              <label className={labelClass}>
                Closing balance
                <span className="text-xs font-normal text-ink/55">Leave blank until the day ends</span>
                <input
                  name="closingBalance"
                  inputMode="numeric"
                  defaultValue={day?.closingBalance ?? ""}
                  className={inputClass}
                />
              </label>
            </ActionForm>
          </Panel>
        ) : null}

        {user.role === "ADMIN" && region ? (
          <Panel title="Cash sent by admin">
            <ActionForm action={saveCashSent} submitLabel="Log cash sent">
              <input type="hidden" name="regionId" value={region.id} />
              <input type="hidden" name="date" value={filters.date} />
              <label className={labelClass}>
                Amount sent to the sales lead
                <input name="amount" inputMode="numeric" defaultValue={sent?.amount ?? ""} className={inputClass} required />
              </label>
            </ActionForm>
          </Panel>
        ) : null}
      </div>

      {summary.agents.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold">Deposits by person</h2>
          <DataTable caption="Expected deposits by person">
            <thead>
              <tr>
                <Th>Person</Th>
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
        </section>
      ) : null}

      {allRegions ? (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold">All leads on {filters.date}</h2>
          <DataTable caption="Cash sent and received by region">
            <thead>
              <tr>
                <Th>Region</Th>
                <Th align="right">Sent</Th>
                <Th align="right">Received</Th>
                <Th>Check</Th>
                <Th align="right">Transaction</Th>
              </tr>
            </thead>
            <tbody>
              {allRegions.cash.map((row) => (
                <tr key={row.regionId}>
                  <Td>
                    <Link className="font-semibold text-pine hover:underline" href={deskHref("/cash", { date: filters.date, region: row.regionId })}>
                      {row.regionName}
                    </Link>
                  </Td>
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
          {allRegions.cash.length === 0 ? <Notice>No cash has been logged for this date.</Notice> : null}
        </section>
      ) : null}
    </>
  )
}
