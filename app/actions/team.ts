"use server"

import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { auditEntry, sameJson } from "@/lib/audit"
import { commit } from "@/lib/commit"
import { activeLead, countActiveAdmins, findByName, findManufacturer, findRegion, findSupplierPhone, findUser, listSupplierPhones, listUsers } from "@/lib/data"
import { getDb } from "@/lib/db"
import { auditLogs, manufacturers, regions, supplierPhones, users, type AuditJson, type UserRole } from "@/lib/db/schema"
import { ActionError, type ActionState } from "@/lib/errors"
import { field, parseWholeNumber } from "@/lib/form"
import { guard } from "@/lib/guard"
import { refreshDesk } from "@/lib/refresh"
import { assertAdmin, requireUser } from "@/lib/session"

export async function saveRegion(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    assertAdmin(user)
    const name = cleanName(field(formData, "name"), "Region name")
    const id = field(formData, "id")
    const clash = await findByName("regions", name, id || undefined)
    if (clash) throw new ActionError("A region with that name already exists.")
    const db = getDb()
    if (!id) {
      const regionId = randomUUID()
      await commit([
        db.insert(regions).values({ id: regionId, name }),
        db.insert(auditLogs).values(
          auditEntry({
            actorId: user.id, actorRole: user.role,
            action: "create",
            entityType: "region",
            entityId: regionId,
            after: { name },
          }),
        ),
      ])
    } else {
      const current = await findRegion(id)
      if (!current) throw new ActionError("That region could not be found.")
      if (current.name !== name) {
        await commit([
          db.update(regions).set({ name }).where(eq(regions.id, id)),
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id, actorRole: user.role,
              action: "update",
              entityType: "region",
              entityId: id,
              before: { name: current.name },
              after: { name },
            }),
          ),
        ])
      }
    }
    refreshDesk()
    return { ok: true }
  })
}

export async function saveManufacturer(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    assertAdmin(user)
    const name = cleanName(field(formData, "name"), "Supplier name")
    const id = field(formData, "id")
    const clash = await findByName("manufacturers", name, id || undefined)
    if (clash) throw new ActionError("A supplier with that name already exists.")
    const db = getDb()
    if (!id) {
      const phone = phoneInput(formData)
      const manufacturerId = randomUUID()
      const phoneId = randomUUID()
      await commit([
        db.insert(manufacturers).values({ id: manufacturerId, name, active: true }),
        db.insert(supplierPhones).values({ id: phoneId, supplierId: manufacturerId, ...phone }),
        db.insert(auditLogs).values(
          auditEntry({
            actorId: user.id, actorRole: user.role,
            action: "create",
            entityType: "manufacturer",
            entityId: manufacturerId,
            after: { name, active: true, phoneType: phone.phoneType, model: phone.model, quantity: phone.quantity },
          }),
        ),
      ])
    } else {
      const current = await findManufacturer(id)
      if (!current) throw new ActionError("That supplier could not be found.")
      const active = field(formData, "active") === "false" ? false : true
      const before: AuditJson = { name: current.name, active: current.active }
      const after: AuditJson = { name, active }
      if (!sameJson(before, after)) {
        await commit([
          db.update(manufacturers).set({ name, active }).where(eq(manufacturers.id, id)),
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id, actorRole: user.role,
              action: active || current.active ? (active === current.active ? "update" : active ? "reactivate" : "deactivate") : "update",
              entityType: "manufacturer",
              entityId: id,
              before,
              after,
            }),
          ),
        ])
      }
    }
    refreshDesk()
    return { ok: true }
  })
}

export async function saveSupplierPhone(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    assertAdmin(user)
    const supplier = await findManufacturer(field(formData, "supplierId"))
    if (!supplier) throw new ActionError("That supplier could not be found.")
    const phone = phoneInput(formData)
    const id = field(formData, "id")
    const phones = await listSupplierPhones()
    const clash = phones.find(
      (row) =>
        row.supplierId === supplier.id &&
        row.model.toLowerCase() === phone.model.toLowerCase() &&
        row.id !== id,
    )
    if (clash) throw new ActionError(`${supplier.name} already has a ${phone.model}.`)
    const db = getDb()
    if (!id) {
      const phoneId = randomUUID()
      await commit([
        db.insert(supplierPhones).values({ id: phoneId, supplierId: supplier.id, ...phone }),
        db.insert(auditLogs).values(
          auditEntry({
            actorId: user.id,
            actorRole: user.role,
            action: "create",
            entityType: "supplier_phone",
            entityId: phoneId,
            after: { supplier: supplier.name, ...phone },
          }),
        ),
      ])
    } else {
      const current = await findSupplierPhone(id)
      if (!current || current.supplierId !== supplier.id) throw new ActionError("That phone could not be found.")
      const before: AuditJson = {
        supplier: supplier.name,
        phoneType: current.phoneType,
        model: current.model,
        quantity: current.quantity,
      }
      const after: AuditJson = { supplier: supplier.name, ...phone }
      if (!sameJson(before, after)) {
        await commit([
          db.update(supplierPhones).set({ ...phone, updatedAt: new Date() }).where(eq(supplierPhones.id, id)),
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id,
              actorRole: user.role,
              action: "update",
              entityType: "supplier_phone",
              entityId: id,
              before,
              after,
            }),
          ),
        ])
      }
    }
    refreshDesk()
    return { ok: true }
  })
}

export async function saveUser(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const actor = await requireUser()
    assertAdmin(actor)
    const id = field(formData, "id")
    const name = cleanName(field(formData, "name"), "Name")
    const email = field(formData, "email").toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ActionError("Enter a valid Google email address.")
    const role = parseRole(field(formData, "role"))
    const current = id ? await findUser(id) : null
    if (id && !current) throw new ActionError("That person could not be found.")
    if (current?.id === actor.id && role !== "ADMIN") {
      throw new ActionError("Ask another admin to change your role.")
    }

    let regionId: string | null = null
    let leadId: string | null = null
    let regionName: string | null = null
    let leadName: string | null = null

    if (role === "SALES_LEAD") {
      const region = await findRegion(field(formData, "regionId"))
      if (!region) throw new ActionError("Choose the region this sales lead will run.")
      const lead = await activeLead(region.id)
      if (lead && lead.id !== current?.id) {
        throw new ActionError(`${region.name} already has ${lead.name} as sales lead. Deactivate them first.`)
      }
      regionId = region.id
      regionName = region.name
    }

    if (role === "SALES_AGENT") {
      const lead = await findUser(field(formData, "leadId"))
      if (!lead?.active || lead.role !== "SALES_LEAD" || !lead.regionId) {
        throw new ActionError("Choose an active sales lead.")
      }
      const region = await findRegion(lead.regionId)
      if (!region) throw new ActionError("That sales lead is not assigned to a region.")
      regionId = region.id
      regionName = region.name
      leadId = lead.id
      leadName = lead.name
    }

    const people = await listUsers()
    const emailOwner = people.find((person) => person.email === email)
    if (emailOwner && emailOwner.id !== current?.id) {
      throw new ActionError("That email is already on an account.")
    }
    if (current?.role === "ADMIN" && role !== "ADMIN") {
      const remaining = await countActiveAdmins(current.id)
      if (current.active && remaining === 0) {
        throw new ActionError("The system needs at least one active admin.")
      }
    }

    const after: AuditJson = { name, email, role, region: regionName, lead: leadName, active: current?.active ?? true }
    const db = getDb()
    if (!current) {
      const userId = randomUUID()
      await commit([
        db.insert(users).values({ id: userId, name, email, role, regionId, leadId, active: true }),
        db.insert(auditLogs).values(
          auditEntry({ actorId: actor.id, actorRole: actor.role, action: "create", entityType: "user", entityId: userId, after }),
        ),
      ])
    } else {
      const before = await userSnapshot(current)
      if (!sameJson(before, after)) {
        await commit([
          db
            .update(users)
            .set({ name, email, role, regionId, leadId, updatedAt: new Date() })
            .where(eq(users.id, current.id)),
          db.insert(auditLogs).values(
            auditEntry({
              actorId: actor.id, actorRole: actor.role,
              action: "update",
              entityType: "user",
              entityId: current.id,
              before,
              after,
            }),
          ),
        ])
      }
    }

    refreshDesk()
    return { ok: true }
  })
}

export async function setUserActive(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const actor = await requireUser()
    assertAdmin(actor)
    const person = await findUser(field(formData, "id"))
    if (!person) throw new ActionError("That person could not be found.")
    if (person.id === actor.id) throw new ActionError("You cannot deactivate your own account.")
    const active = field(formData, "active") === "true"
    if (person.active === active) return { ok: true }
    if (!active && person.role === "ADMIN" && person.active) {
      const remaining = await countActiveAdmins(person.id)
      if (remaining === 0) throw new ActionError("The system needs at least one active admin.")
    }
    if (active && person.role === "SALES_LEAD" && person.regionId) {
      const lead = await activeLead(person.regionId)
      if (lead && lead.id !== person.id) {
        throw new ActionError("That region already has an active sales lead.")
      }
    }
    const before = await userSnapshot(person)
    const region = person.regionId ? await findRegion(person.regionId) : null
    const lead = person.leadId ? await findUser(person.leadId) : null
    const after: AuditJson = {
      name: person.name,
      email: person.email,
      role: person.role,
      region: region?.name ?? null,
      lead: lead?.name ?? null,
      active,
    }
    const db = getDb()
    await commit([
      db.update(users).set({ active, updatedAt: new Date() }).where(eq(users.id, person.id)),
      db.insert(auditLogs).values(
        auditEntry({
          actorId: actor.id, actorRole: actor.role,
          action: active ? "reactivate" : "deactivate",
          entityType: "user",
          entityId: person.id,
          before,
          after,
        }),
      ),
    ])
    refreshDesk()
    return { ok: true }
  })
}

async function userSnapshot(person: {
  name: string
  email: string
  role: UserRole
  regionId: string | null
  leadId: string | null
  active: boolean
}): Promise<AuditJson> {
  const region = person.regionId ? await findRegion(person.regionId) : null
  const lead = person.leadId ? await findUser(person.leadId) : null
  return {
    name: person.name,
    email: person.email,
    role: person.role,
    region: region?.name ?? null,
    lead: lead?.name ?? null,
    active: person.active,
  }
}

function cleanName(value: string, label: string) {
  if (value.length < 2 || value.length > 80) throw new ActionError(`${label} should be between 2 and 80 characters.`)
  return value
}

function phoneInput(formData: FormData) {
  return {
    phoneType: cleanName(field(formData, "phoneType"), "Type of phone"),
    model: cleanName(field(formData, "model"), "Model"),
    quantity: parseWholeNumber(field(formData, "quantity"), "Quantity supplied"),
  }
}

function parseRole(value: string): UserRole {
  if (value === "ADMIN" || value === "SALES_LEAD" || value === "SALES_AGENT") return value
  throw new ActionError("Choose a role.")
}
