"use server"

import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { auditEntry, sameJson } from "@/lib/audit"
import { availableToSell, stockCell } from "@/lib/books"
import { commit } from "@/lib/commit"
import {
  findRegion,
  findUser,
  listManufacturers,
  loadStockMovements,
  movementsForRegion,
  openingsForRegion,
  priceRow,
} from "@/lib/data"
import { getDb } from "@/lib/db"
import { auditLogs, dailyPrices, sales, type AuditJson } from "@/lib/db/schema"
import { ActionError, type ActionState } from "@/lib/errors"
import { field, parseDate, parseWholeNumber } from "@/lib/form"
import { guard } from "@/lib/guard"
import { refreshDesk } from "@/lib/refresh"
import { assertRegionAccess, requireUser } from "@/lib/session"

export async function saveSales(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    const date = parseDate(field(formData, "date"))
    const sellerId = user.role === "SALES_AGENT" ? user.id : field(formData, "agentId")
    const seller = sellerId === user.id ? user : await findUser(sellerId)
    if (!seller?.active || (seller.role !== "SALES_AGENT" && seller.role !== "SALES_LEAD")) {
      throw new ActionError("Choose an active sales agent or sales lead.")
    }
    if (!seller.regionId) throw new ActionError("That person is not assigned to a region.")
    assertRegionAccess(user, seller.regionId)
    const region = await findRegion(seller.regionId)
    if (!region) throw new ActionError("That region no longer exists.")

    const stock = await loadStockMovements()
    const openings = openingsForRegion(stock.openings, region.id)
    const regionAllocations = movementsForRegion(stock.allocations, region.id)
    const regionSales = movementsForRegion(stock.sales, region.id)
    const db = getDb()
    const existing = await db
      .select()
      .from(sales)
      .where(and(eq(sales.agentId, seller.id), eq(sales.saleDate, date)))
    const statements = []

    for (const manufacturer of await listManufacturers()) {
      const fieldName = `qty.${manufacturer.id}`
      if (!formData.has(fieldName)) continue
      const quantity = parseWholeNumber(field(formData, fieldName), `${manufacturer.name} phones sold`, {
        allowEmptyAs: 0,
        max: 1_000_000,
      })
      const current = existing.find((row) => row.manufacturerId === manufacturer.id)
      const currentQty = current?.quantity ?? 0
      if (!current && quantity === 0) continue
      const cell = stockCell({
        manufacturerId: manufacturer.id,
        date,
        openings,
        allocations: regionAllocations,
        sales: regionSales,
      })
      const available = availableToSell({
        opening: cell.opening,
        receivedToday: cell.received,
        soldByOthersToday: cell.sold - currentQty,
        onHandIfThisLineIsZero: cell.onHand + currentQty,
      })
      if (quantity > available) {
        throw new ActionError(
          `Only ${Math.max(available, 0)} ${manufacturer.name} phones are available in ${region.name} on ${date}.`,
        )
      }
      const before: AuditJson | null = current
        ? { region: region.name, manufacturer: manufacturer.name, agent: seller.name, date, quantity: current.quantity }
        : null
      const after: AuditJson = {
        region: region.name,
        manufacturer: manufacturer.name,
        agent: seller.name,
        date,
        quantity,
      }
      if (before && sameJson(before, after)) continue
      if (current) {
        statements.push(
          db
            .update(sales)
            .set({ quantity, recordedBy: user.id, updatedAt: new Date() })
            .where(eq(sales.id, current.id)),
        )
        statements.push(
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id, actorRole: user.role,
              action: "update",
              entityType: "sale",
              entityId: current.id,
              before,
              after,
            }),
          ),
        )
      } else {
        const saleId = randomUUID()
        statements.push(
          db.insert(sales).values({
            id: saleId,
            regionId: region.id,
            manufacturerId: manufacturer.id,
            agentId: seller.id,
            saleDate: date,
            quantity,
            recordedBy: user.id,
          }),
        )
        statements.push(
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id, actorRole: user.role,
              action: "create",
              entityType: "sale",
              entityId: saleId,
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

export async function savePrices(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    if (user.role === "SALES_AGENT") throw new ActionError("Sales agents do not set deposit prices.")
    const regionId = user.role === "ADMIN" ? field(formData, "regionId") : user.regionId
    if (!regionId) throw new ActionError("Choose a region.")
    assertRegionAccess(user, regionId)
    const region = await findRegion(regionId)
    if (!region) throw new ActionError("Choose a region.")
    const date = parseDate(field(formData, "date"))
    const db = getDb()
    const statements = []

    for (const manufacturer of await listManufacturers()) {
      if (!manufacturer.active) continue
      const raw = field(formData, `price.${manufacturer.id}`)
      if (!raw) continue
      const unitPrice = parseWholeNumber(raw, `${manufacturer.name} deposit`, { max: 1_000_000 })
      const current = await priceRow(region.id, manufacturer.id, date)
      const before: AuditJson | null = current
        ? { region: region.name, manufacturer: manufacturer.name, date, deposit: current.unitPrice }
        : null
      const after: AuditJson = {
        region: region.name,
        manufacturer: manufacturer.name,
        date,
        deposit: unitPrice,
      }
      if (before && sameJson(before, after)) continue
      if (current) {
        statements.push(
          db
            .update(dailyPrices)
            .set({ unitPrice, recordedBy: user.id, updatedAt: new Date() })
            .where(eq(dailyPrices.id, current.id)),
        )
        statements.push(
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id, actorRole: user.role,
              action: "update",
              entityType: "daily_price",
              entityId: current.id,
              before,
              after,
            }),
          ),
        )
      } else {
        const priceId = randomUUID()
        statements.push(
          db.insert(dailyPrices).values({
            id: priceId,
            regionId: region.id,
            manufacturerId: manufacturer.id,
            priceDate: date,
            unitPrice,
            recordedBy: user.id,
          }),
        )
        statements.push(
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id, actorRole: user.role,
              action: "create",
              entityType: "daily_price",
              entityId: priceId,
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
