import type { Metadata } from "next"
import { Suspense } from "react"
import { saveManufacturer, saveRegion, saveUser, setUserActive } from "@/app/actions/team"
import { ActionForm } from "@/components/action-form"
import { Notice, PageHeader, Panel, inputClass, labelClass } from "@/components/ui"
import { listManufacturers, listRegions, listUsers } from "@/lib/data"
import { roleLabel } from "@/lib/format"
import { requireRole, requireUser } from "@/lib/session"

export const instant = false
export const metadata: Metadata = { title: "Team" }

export default function TeamPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink/60">Loading the team…</p>}>
      <Team />
    </Suspense>
  )
}

async function Team() {
  const user = await requireUser()
  requireRole(user, ["ADMIN"])
  const [regions, manufacturers, people] = await Promise.all([listRegions(), listManufacturers(), listUsers()])
  const leads = people.filter((person) => person.active && person.role === "SALES_LEAD" && person.regionId)

  return (
    <>
      <PageHeader
        title="Team"
        lede="Add regions, manufacturers, sales leads, and sales agents. Removing someone deactivates the account. Their sales, stock, and cash history stay in the reports."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Regions">
          <ActionForm action={saveRegion} submitLabel="Add region">
            <label className={labelClass}>
              Name
              <input name="name" className={inputClass} required />
            </label>
          </ActionForm>
          <div className="mt-4 grid gap-3">
            {regions.map((region) => (
              <ActionForm key={region.id} action={saveRegion} submitLabel="Rename" compact>
                <input type="hidden" name="id" value={region.id} />
                <label className={labelClass}>
                  <span className="sr-only">Region name</span>
                  <input name="name" defaultValue={region.name} className={inputClass} required />
                </label>
              </ActionForm>
            ))}
          </div>
        </Panel>
        <Panel title="Manufacturers">
          <ActionForm action={saveManufacturer} submitLabel="Add manufacturer">
            <label className={labelClass}>
              Name
              <input name="name" className={inputClass} required />
            </label>
          </ActionForm>
          <div className="mt-4 grid gap-3">
            {manufacturers.map((manufacturer) => (
              <ActionForm key={manufacturer.id} action={saveManufacturer} submitLabel="Update" compact>
                <input type="hidden" name="id" value={manufacturer.id} />
                <label className={labelClass}>
                  <span className="sr-only">Manufacturer name</span>
                  <input name="name" defaultValue={manufacturer.name} className={inputClass} required />
                </label>
                <label className={labelClass}>
                  Status
                  <select name="active" defaultValue={manufacturer.active ? "true" : "false"} className={inputClass}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
              </ActionForm>
            ))}
          </div>
        </Panel>
      </div>

      <section className="mt-6">
        <Panel title="Add a person">
          <p className="mb-3 text-sm leading-6 text-ink/70">
            Use the email on their Google account. A region can have one active sales lead. Agents are placed under that
            lead. Deactivate the current lead before appointing another.
          </p>
          <UserFields actionLabel="Add person" regions={regions} leads={leads} />
        </Panel>
      </section>

      <section className="mt-6 grid gap-4">
        {people.map((person) => {
          const region = regions.find((item) => item.id === person.regionId)
          const lead = people.find((item) => item.id === person.leadId)
          return (
            <Panel
              key={person.id}
              title={person.name}
              aside={
                <span className="text-xs text-ink/55">
                  {roleLabel(person.role)}
                  {region ? ` · ${region.name}` : ""}
                  {lead ? ` · lead ${lead.name}` : ""}
                  {person.active ? "" : " · deactivated"}
                </span>
              }
            >
              <UserFields
                actionLabel="Save changes"
                regions={regions}
                leads={leads}
                person={person}
                lockedRole={person.id === user.id}
              />
              {person.id === user.id ? null : (
                <div className="mt-3">
                  <ActionForm
                    action={setUserActive}
                    submitLabel={person.active ? "Deactivate account" : "Reactivate account"}
                    compact
                  >
                    <input type="hidden" name="id" value={person.id} />
                    <input type="hidden" name="active" value={person.active ? "false" : "true"} />
                  </ActionForm>
                </div>
              )}
            </Panel>
          )
        })}
      </section>
      {people.length === 0 ? (
        <Notice>No users yet. The Google addresses in ADMIN_EMAIL become admins when they sign in.</Notice>
      ) : null}
    </>
  )
}

function UserFields({
  actionLabel,
  regions,
  leads,
  person,
  lockedRole = false,
}: {
  actionLabel: string
  regions: { id: string; name: string }[]
  leads: { id: string; name: string; regionId: string | null }[]
  person?: { id: string; name: string; email: string; role: string; regionId: string | null; leadId: string | null }
  lockedRole?: boolean
}) {
  return (
    <ActionForm action={saveUser} submitLabel={actionLabel}>
      {person ? <input type="hidden" name="id" value={person.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className={labelClass}>
          Name
          <input name="name" defaultValue={person?.name ?? ""} className={inputClass} required />
        </label>
        <label className={labelClass}>
          Google email
          <input name="email" type="email" defaultValue={person?.email ?? ""} className={inputClass} required />
        </label>
        <label className={labelClass}>
          Role
          {lockedRole ? <input type="hidden" name="role" value="ADMIN" /> : null}
          <select name="role" defaultValue={person?.role ?? "SALES_AGENT"} className={inputClass} disabled={lockedRole}>
            <option value="ADMIN">Admin</option>
            <option value="SALES_LEAD">Sales lead</option>
            <option value="SALES_AGENT">Sales agent</option>
          </select>
        </label>
        <label className={labelClass}>
          Region
          <span className="text-xs font-normal text-ink/55">Required for a sales lead</span>
          <select name="regionId" defaultValue={person?.regionId ?? ""} className={inputClass}>
            <option value="">None</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Sales lead
          <span className="text-xs font-normal text-ink/55">Required for a sales agent. The agent joins that lead’s region.</span>
          <select name="leadId" defaultValue={person?.leadId ?? ""} className={inputClass}>
            <option value="">None</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name} · {regions.find((region) => region.id === lead.regionId)?.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </ActionForm>
  )
}
