"use server"

import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { auditEntry, sameJson } from "@/lib/audit"
import { centralRemaining, closingStock, stockCell } from "@/lib/books"
import { commit } from "@/lib/commit"
import {
  findManufacturer,
  findRegion,
  listManufacturers,
  loadAllocationRows,
  loadCentralMovements,
  loadStockMovements,
  movementsForRegion,
  openingsForRegion,
} from "@/lib/data"
import { getDb } from "@/lib/db"
import { allocations, auditLogs, centralReceipts, dailyOpenings, type AuditJson } from "@/lib/db/schema"
import { ActionError, type ActionState } from "@/lib/errors"
import { field, parseDate, parseNotes, parseWholeNumber } from "@/lib/form"
import { guard } from "@/lib/guard"
import { refreshDesk } from "@/lib/refresh"
import { assertAdmin, assertRegionAccess, requireUser } from "@/lib/session"

export async function saveReceipt(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    assertAdmin(user)
    const date = parseDate(field(formData, "date"))
    const manufacturer = await findManufacturer(field(formData, "manufacturerId"))
    if (!manufacturer?.active) throw new ActionError("Choose an active manufacturer.")
    const quantity = parseWholeNumber(field(formData, "quantity"), "Quantity", { max: 1_000_000 })
    const notes = parseNotes(field(formData, "notes"))
    const id = field(formData, "id")
    const db = getDb()
    const central = await loadCentralMovements()
    const received = central.receipts
      .filter((row) => row.manufacturerId === manufacturer.id)
      .reduce((sum, row) => sum + row.quantity, 0)
    const allocated = central.allocations
      .filter((row) => row.manufacturerId === manufacturer.id)
      .reduce((sum, row) => sum + row.quantity, 0)

    if (id) {
      const current = central.receipts.find((row) => row.id === id)
      if (!current || current.manufacturerId !== manufacturer.id) {
        throw new ActionError("That receipt could not be found.")
      }
      if (current.date !== date) {
        throw new ActionError("Keep the original date. Record a separate receipt for another day.")
      }
      if (received - current.quantity + quantity < allocated) {
        throw new ActionError("That would leave less central stock than has already been allocated.")
      }
      const before = receiptSnapshot(manufacturer.name, current)
      const after = receiptSnapshot(manufacturer.name, { ...current, quantity, date, notes })
      if (!sameJson(before, after)) {
        await commit([
          db
            .update(centralReceipts)
            .set({ quantity, receivedOn: date, notes, updatedAt: new Date() })
            .where(eq(centralReceipts.id, id)),
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id,
              action: "update",
              entityType: "central_receipt",
              entityId: id,
              before,
              after,
            }),
          ),
        ])
      }
    } else {
      if (quantity < 1) throw new ActionError("Enter the number of phones received.")
      if (centralRemaining(received, allocated) + quantity < 0) {
        throw new ActionError("Central stock cannot go below zero.")
      }
      const receiptId = randomUUID()
      await commit([
        db.insert(centralReceipts).values({
          id: receiptId,
          manufacturerId: manufacturer.id,
          quantity,
          receivedOn: date,
          notes,
          recordedBy: user.id,
        }),
        db.insert(auditLogs).values(
          auditEntry({
            actorId: user.id,
            action: "create",
            entityType: "central_receipt",
            entityId: receiptId,
            after: receiptSnapshot(manufacturer.name, { quantity, date, notes }),
          }),
        ),
      ])
    }

    refreshDesk()
    return { ok: true }
  })
}

export async function saveAllocation(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    assertAdmin(user)
    const date = parseDate(field(formData, "date"))
    const region = await findRegion(field(formData, "regionId"))
    const manufacturer = await findManufacturer(field(formData, "manufacturerId"))
    if (!region) throw new ActionError("Choose a region.")
    if (!manufacturer?.active) throw new ActionError("Choose an active manufacturer.")
    const quantity = parseWholeNumber(field(formData, "quantity"), "Quantity", { max: 1_000_000 })
    const notes = parseNotes(field(formData, "notes"))
    const id = field(formData, "id")
    const db = getDb()
    const central = await loadCentralMovements()
    const received = central.receipts
      .filter((row) => row.manufacturerId === manufacturer.id)
      .reduce((sum, row) => sum + row.quantity, 0)
    const allocated = central.allocations
      .filter((row) => row.manufacturerId === manufacturer.id)
      .reduce((sum, row) => sum + row.quantity, 0)
    const stock = await loadStockMovements()
    const cell = stockCell({
      manufacturerId: manufacturer.id,
      date,
      openings: openingsForRegion(stock.openings, region.id),
      allocations: movementsForRegion(stock.allocations, region.id),
      sales: movementsForRegion(stock.sales, region.id),
    })

    if (id) {
      const rows = await loadAllocationRows()
      const current = rows.find((row) => row.id === id)
      if (!current || current.regionId !== region.id || current.manufacturerId !== manufacturer.id) {
        throw new ActionError("That allocation could not be found.")
      }
      if (current.date !== date) {
        throw new ActionError("Keep the original date. Record a separate allocation for another day.")
      }
      if (quantity > centralRemaining(received, allocated) + current.quantity) {
        throw new ActionError("Central stock does not have that many phones.")
      }
      const nextOnHand = cell.onHand - current.quantity + quantity
      const nextReceived = cell.received - (current.date === date ? current.quantity : 0) + quantity
      if (nextOnHand < 0) {
        throw new ActionError("That allocation would take regional stock below the phones already sold.")
      }
      if (cell.opening !== null && closingStock(cell.opening, nextReceived, cell.sold) < 0) {
        throw new ActionError("That allocation would make today's closing stock negative.")
      }
      const before = allocationSnapshot(region.name, manufacturer.name, current)
      const after = allocationSnapshot(region.name, manufacturer.name, { quantity, date, notes })
      if (!sameJson(before, after)) {
        await commit([
          db
            .update(allocations)
            .set({ quantity, allocatedOn: date, notes, updatedAt: new Date() })
            .where(eq(allocations.id, id)),
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id,
              action: "update",
              entityType: "allocation",
              entityId: id,
              before,
              after,
            }),
          ),
        ])
      }
    } else {
      if (quantity < 1) throw new ActionError("Enter the number of phones to allocate.")
      if (quantity > centralRemaining(received, allocated)) {
        throw new ActionError("Central stock does not have that many phones.")
      }
      const allocationId = randomUUID()
      await commit([
        db.insert(allocations).values({
          id: allocationId,
          regionId: region.id,
          manufacturerId: manufacturer.id,
          quantity,
          allocatedOn: date,
          notes,
          recordedBy: user.id,
        }),
        db.insert(auditLogs).values(
          auditEntry({
            actorId: user.id,
            action: "create",
            entityType: "allocation",
            entityId: allocationId,
            after: allocationSnapshot(region.name, manufacturer.name, { quantity, date, notes }),
          }),
        ),
      ])
    }

    refreshDesk()
    return { ok: true }
  })
}

export async function saveOpenings(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    if (user.role === "SALES_AGENT") throw new ActionError("Sales agents do not record opening stock.")
    const regionId = user.role === "ADMIN" ? field(formData, "regionId") : user.regionId
    if (!regionId) throw new ActionError("Choose a region.")
    assertRegionAccess(user, regionId)
    const region = await findRegion(regionId)
    if (!region) throw new ActionError("Choose a region.")
    const date = parseDate(field(formData, "date"))
    const stock = await loadStockMovements()
    const openings = openingsForRegion(stock.openings, region.id)
    const regionAllocations = movementsForRegion(stock.allocations, region.id)
    const regionSales = movementsForRegion(stock.sales, region.id)
    const db = getDb()
    const statements = []

    for (const manufacturer of await listManufacturers()) {
      if (!manufacturer.active) continue
      const quantity = parseWholeNumber(field(formData, `opening.${manufacturer.id}`), `${manufacturer.name} opening stock`, {
        max: 1_000_000,
      })
      const cell = stockCell({
        manufacturerId: manufacturer.id,
        date,
        openings,
        allocations: regionAllocations,
        sales: regionSales,
      })
      if (closingStock(quantity, cell.received, cell.sold) < 0) {
        throw new ActionError(
          `${manufacturer.name} opening stock is lower than the phones already sold that day.`,
        )
      }
      const current = await db
        .select()
        .from(dailyOpenings)
        .where(eq(dailyOpenings.regionId, region.id))
      const existing = current.find((row) => row.manufacturerId === manufacturer.id && row.stockDate === date)
      const before: AuditJson | null = existing
        ? { region: region.name, manufacturer: manufacturer.name, date, opening: existing.openingQty }
        : null
      const after: AuditJson = {
        region: region.name,
        manufacturer: manufacturer.name,
        date,
        opening: quantity,
      }
      if (before && sameJson(before, after)) continue
      if (existing) {
        statements.push(
          db
            .update(dailyOpenings)
            .set({ openingQty: quantity, recordedBy: user.id, updatedAt: new Date() })
            .where(eq(dailyOpenings.id, existing.id)),
        )
        statements.push(
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id,
              action: "update",
              entityType: "daily_opening",
              entityId: existing.id,
              before,
              after,
            }),
          ),
        )
      } else {
        const openingId = randomUUID()
        statements.push(
          db.insert(dailyOpenings).values({
            id: openingId,
            regionId: region.id,
            manufacturerId: manufacturer.id,
            stockDate: date,
            openingQty: quantity,
            recordedBy: user.id,
          }),
        )
        statements.push(
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id,
              action: "create",
              entityType: "daily_opening",
              entityId: openingId,
              after,
            }),
          ),
        )
      }
    }

    await commit(statements)
    refreshDesk()
    return { ok: true }
  })
}

function receiptSnapshot(
  manufacturer: string,
  row: { quantity: number; date: string; notes: string | null },
): AuditJson {
  return { manufacturer, quantity: row.quantity, date: row.date, notes: row.notes }
}

function allocationSnapshot(
  region: string,
  manufacturer: string,
  row: { quantity: number; date: string; notes: string | null },
): AuditJson {
  return { region, manufacturer, quantity: row.quantity, date: row.date, notes: row.notes }
}
