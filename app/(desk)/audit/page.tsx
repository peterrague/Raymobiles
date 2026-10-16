import type { Metadata } from "next"
import { Suspense } from "react"
import { DataTable, Notice, PageHeader, Td, Th } from "@/components/ui"
import { recentAudit } from "@/lib/data"
import type { AuditJson } from "@/lib/db/schema"
import { formatWhen } from "@/lib/format"
import { requireRole, requireUser } from "@/lib/session"

export const instant = false
export const metadata: Metadata = { title: "Audit log" }

const ENTITIES: Record<string, string> = {
  central_receipt: "Central receipt",
  allocation: "Allocation",
  daily_opening: "Opening stock",
  daily_price: "Deposit price",
  sale: "Sale",
  cash_day: "Cash day",
  cash_sent: "Cash sent",
  user: "User",
  region: "Region",
  manufacturer: "Supplier",
  supplier_phone: "Supplier phone",
}

export default function AuditPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink/60">Loading the audit log…</p>}>
      <Audit />
    </Suspense>
  )
}

async function Audit() {
  const user = await requireUser()
  requireRole(user, ["ADMIN"])
  const rows = await recentAudit()

  return (
    <>
      <PageHeader
        title="Audit log"
        lede="Every change to stock, prices, sales, cash, users, and roles. The log records who made the change, when, and the values before and after. It cannot be edited or deleted."
      />
      {rows.length === 0 ? <Notice>No changes have been recorded yet.</Notice> : null}
      <DataTable caption="Audit log">
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>Change</Th>
            <Th>Before</Th>
            <Th>After</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>{formatWhen(row.createdAt)}</Td>
              <Td>{row.actorName}</Td>
              <Td>
                {row.action} · {ENTITIES[row.entityType] ?? row.entityType}
              </Td>
              <Td>
                <Snapshot value={row.before} />
              </Td>
              <Td>
                <Snapshot value={row.after} />
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {rows.length === 150 ? <p className="mt-3 text-sm text-ink/60">Showing the latest 150 changes.</p> : null}
    </>
  )
}

function Snapshot({ value }: { value: AuditJson | null }) {
  if (!value) return <>—</>
  return (
    <dl className="grid gap-1 text-xs">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <dt className="inline text-ink/50">{key}: </dt>
          <dd className="inline">{item === null ? "—" : String(item)}</dd>
        </div>
      ))}
    </dl>
  )
}
