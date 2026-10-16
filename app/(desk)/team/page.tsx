import type { Metadata } from "next"
import { Suspense } from "react"
import { saveManufacturer, saveRegion, saveSupplierPhone, saveUser, setUserActive } from "@/app/actions/team"
import { ActionForm } from "@/components/action-form"
import { DataTable, Notice, PageHeader, Panel, Td, Th, inputClass, labelClass } from "@/components/ui"
import { listManufacturers, listRegions, listSupplierPhones, listUsers } from "@/lib/data"
import { formatNumber, roleLabel } from "@/lib/format"
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
  const [regions, manufacturers, phones, people] = await Promise.all([
    listRegions(),
    listManufacturers(),
    listSupplierPhones(),
    listUsers(),
  ])
  const leads = people.filter((person) => person.active && person.role === "SALES_LEAD" && person.regionId)

  return (
    <>
      <PageHeader
        title="Team"
        lede="Jill is a supplier, and you can add others. Samsung, Tecno, Infinix, and Oppo are phones under a supplier, with a model and quantity. Removing someone deactivates the account. Their sales, stock, and cash history stay in the reports."
      />
      <div className="grid gap-4">
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
      </div>
      <div className="mt-4">
        <Panel title="Suppliers">
          <ActionForm action={saveManufacturer} submitLabel="Add supplier">
            <label className={labelClass}>
              Supplier
              <input name="name" className={inputClass} placeholder="Jill" required />
            </label>
            <PhoneFields />
          </ActionForm>
          <div className="mt-4 grid gap-4">
            {manufacturers
              .filter((manufacturer) => manufacturer.active)
              .map((manufacturer) => {
                const lines = phones.filter((phone) => phone.supplierId === manufacturer.id)
                return (
                  <div key={manufacturer.id} className="rounded-lg border border-line p-3">
                    <ActionForm action={saveManufacturer} submitLabel="Update" compact>
                      <input type="hidden" name="id" value={manufacturer.id} />
                      <label className={labelClass}>
                        <span className="sr-only">Supplier name</span>
                        <input name="name" defaultValue={manufacturer.name} className={inputClass} required />
                      </label>
                      <label className={labelClass}>
                        Status
                        <select name="active" defaultValue="true" className={inputClass}>
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </label>
                    </ActionForm>
                    <div className="mt-3">
                      {lines.length === 0 ? (
                        <p className="mb-2 text-sm text-ink/60">No phones under {manufacturer.name} yet.</p>
                      ) : (
                        <DataTable caption={`Phones from ${manufacturer.name}`}>
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
                      {lines.map((phone) => (
                        <div key={`edit-${phone.id}`} className="mt-3">
                          <ActionForm action={saveSupplierPhone} submitLabel="Update phone" compact>
                            <input type="hidden" name="id" value={phone.id} />
                            <input type="hidden" name="supplierId" value={manufacturer.id} />
                            <PhoneFields phone={phone} />
                          </ActionForm>
                        </div>
                      ))}
                      <div className="mt-3">
                        <p className="mb-2 text-sm font-medium">Add a phone</p>
                        <p className="mb-2 text-sm text-ink/60">
                          The type is the product, such as Samsung, Tecno, Infinix, or Oppo. Then add the model and quantity.
                        </p>
                        <ActionForm action={saveSupplierPhone} submitLabel="Add phone">
                          <input type="hidden" name="supplierId" value={manufacturer.id} />
                          <PhoneFields />
                        </ActionForm>
                      </div>
                    </div>
                  </div>
                )
              })}
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

function PhoneFields({
  phone,
}: {
  phone?: { phoneType: string; model: string; quantity: number }
}) {
  return (
    <>
      <label className={labelClass}>
        Type of phone
        <input name="phoneType" defaultValue={phone?.phoneType ?? ""} className={inputClass} placeholder="Samsung" required />
      </label>
      <label className={labelClass}>
        Model
        <input name="model" defaultValue={phone?.model ?? ""} className={inputClass} placeholder="Samsung A07" required />
      </label>
      <label className={labelClass}>
        Quantity supplied
        <input
          name="quantity"
          inputMode="numeric"
          defaultValue={phone?.quantity ?? ""}
          className={inputClass}
          placeholder="100"
          required
        />
      </label>
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
