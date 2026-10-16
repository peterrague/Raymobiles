"use server"

import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { auditEntry } from "@/lib/audit"
import { centralRemaining, closingStock, stockCell } from "@/lib/books"
import { commit } from "@/lib/commit"
import {
  activeLead,
  cashSend,
  dailySetup,
  findManufacturer,
  findRegion,
  findSupplierPhone,
  findUser,
  listManufacturers,
  listRegions,
  loadAllocationRows,
  loadCentralMovements,
  loadStockMovements,
  movementsForRegion,
  openingsForRegion,
} from "@/lib/data"
import { getDb } from "@/lib/db"
import { allocations, auditLogs, cashSends, centralReceipts, dailySetups, type AuditJson } from "@/lib/db/schema"
import { ActionError, type ActionState } from "@/lib/errors"
import { parseDate, parseWholeNumber } from "@/lib/form"
import { guard } from "@/lib/guard"
import { refreshDesk } from "@/lib/refresh"
import { assertAdmin, requireUser } from "@/lib/session"

const NOTE = "Daily setup"

export type DailySetupInput = {
  date: string
  supplierId: string
  phoneId: string
  quantity: string
  sends: { regionId: string; quantity: string }[]
  cash: { regionId: string; amount: string }[]
}

export async function saveDailyDraft(_state: ActionState, input: DailySetupInput): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    assertAdmin(user)
    const plan = readPlan(input, false)
    await storePlan(user.id, plan, "draft")
    refreshDesk()
    return { ok: true }
  })
}

export async function submitDailySetup(_state: ActionState, input: DailySetupInput): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    assertAdmin(user)
    const plan = readPlan(input, true)
    const phone = plan.phoneId ? await findSupplierPhone(plan.phoneId) : null
    const manufacturer = plan.supplierId ? await findManufacturer(plan.supplierId) : null
    if (plan.started) {
      if (!phone || !manufacturer || phone.supplierId !== manufacturer.id) {
        throw new ActionError("Choose a phone type and model from that supplier.")
      }
      if (!manufacturer.active) throw new ActionError("Choose an active supplier.")
    }

    const db = getDb()
    const existing = await dailySetup(plan.date)
    const [central, allocationRows, stock, manufacturers] = await Promise.all([
      loadCentralMovements(),
      loadAllocationRows(),
      loadStockMovements(),
      listManufacturers(),
    ])
    const activeIds = manufacturers.filter((item) => item.active).map((item) => item.id)
    const regions = await regionsOnHand(plan.date, activeIds, stock, existing?.allocations ?? [], allocationRows)
    const targets = plan.started ? plan.sends : []
    const oldReceipt = existing?.receiptId
      ? central.receipts.find((row) => row.id === existing.receiptId)
      : undefined
    const oldLinks = existing?.allocations ?? []
    const oldAllocQty = (regionId: string) =>
      oldLinks
        .filter((link) => link.regionId === regionId)
        .reduce((sum, link) => sum + (allocationRows.find((row) => row.id === link.allocationId)?.quantity ?? 0), 0)
    const oldAllocSum = regions.reduce((sum, region) => sum + oldAllocQty(region.id), 0)
    const receiptQty = plan.started ? (plan.quantity ?? 0) : 0
    const targetSum = targets.reduce((sum, row) => sum + row.quantity, 0)
    assertCentral(central, manufacturer?.id, oldReceipt?.manufacturerId, oldReceipt?.quantity ?? 0, oldAllocSum, receiptQty, targetSum)

    for (const region of regions) {
      const nextQty = targets.find((row) => row.regionId === region.id)?.quantity ?? 0
      const previous = oldAllocQty(region.id)
      const supplierForRegion = manufacturer?.id ?? oldReceipt?.manufacturerId
      if (oldReceipt?.manufacturerId && manufacturer && oldReceipt.manufacturerId !== manufacturer.id && previous > 0) {
        const leaving = stockCell({
          manufacturerId: oldReceipt.manufacturerId,
          date: plan.date,
          openings: openingsForRegion(stock.openings, region.id),
          allocations: movementsForRegion(stock.allocations, region.id),
          sales: movementsForRegion(stock.sales, region.id),
        })
        if (leaving.onHand - previous < 0) throw new ActionError(`${region.name} has already sold phones from this delivery.`)
        if (leaving.opening !== null && closingStock(leaving.opening, leaving.received - previous, leaving.sold) < 0) {
          throw new ActionError(`That would make ${region.name}'s closing stock negative.`)
        }
      }
      if (!supplierForRegion || (previous === 0 && nextQty === 0)) continue
      const checked = stockCell({
        manufacturerId: supplierForRegion,
        date: plan.date,
        openings: openingsForRegion(stock.openings, region.id),
        allocations: movementsForRegion(stock.allocations, region.id),
        sales: movementsForRegion(stock.sales, region.id),
      })
      const already = oldReceipt?.manufacturerId === supplierForRegion ? previous : 0
      const nextOnHand = checked.onHand - already + nextQty
      const nextReceived = checked.received - already + nextQty
      if (nextOnHand < 0) throw new ActionError(`${region.name} has already sold phones from this delivery.`)
      if (checked.opening !== null && closingStock(checked.opening, nextReceived, checked.sold) < 0) {
        throw new ActionError(`That would make ${region.name}'s closing stock negative.`)
      }
    }

    const statements = []
    let receiptId = existing?.receiptId ?? null
    if (plan.started && phone && manufacturer) {
      if (!receiptId || !oldReceipt) {
        receiptId = randomUUID()
        statements.push(
          db.insert(centralReceipts).values({
            id: receiptId,
            manufacturerId: manufacturer.id,
            phoneId: phone.id,
            quantity: plan.quantity ?? 0,
            receivedOn: plan.date,
            notes: NOTE,
            reference: receiptId,
            recordedBy: user.id,
          }),
        )
        statements.push(
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id,
              actorRole: user.role,
              action: "create",
              entityType: "central_receipt",
              entityId: receiptId,
              after: receiptAudit(manufacturer.name, phone, plan.quantity ?? 0, plan.date),
            }),
          ),
        )
      } else {
        statements.push(
          db
            .update(centralReceipts)
            .set({
              manufacturerId: manufacturer.id,
              phoneId: phone.id,
              quantity: plan.quantity ?? 0,
              receivedOn: plan.date,
              notes: NOTE,
              updatedAt: new Date(),
            })
            .where(eq(centralReceipts.id, receiptId)),
        )
        statements.push(
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id,
              actorRole: user.role,
              action: "update",
              entityType: "central_receipt",
              entityId: receiptId,
              before: receiptAudit(manufacturer.name, phone, oldReceipt.quantity, oldReceipt.date),
              after: receiptAudit(manufacturer.name, phone, plan.quantity ?? 0, plan.date),
            }),
          ),
        )
      }
    } else if (receiptId && oldReceipt && oldReceipt.quantity !== 0) {
      statements.push(
        db
          .update(centralReceipts)
          .set({ quantity: 0, notes: NOTE, updatedAt: new Date() })
          .where(eq(centralReceipts.id, receiptId)),
      )
    }

    const nextLinks: { regionId: string; allocationId: string }[] = []
    const touched = new Set<string>()
    for (const target of targets) {
      const link = oldLinks.find((item) => item.regionId === target.regionId)
      const allocationId = link?.allocationId ?? randomUUID()
      touched.add(target.regionId)
      nextLinks.push({ regionId: target.regionId, allocationId })
      const regionName = regions.find((region) => region.id === target.regionId)?.name ?? "Region"
      if (link && allocationRows.some((row) => row.id === link.allocationId)) {
        statements.push(
          db
            .update(allocations)
            .set({
              manufacturerId: manufacturer!.id,
              phoneId: phone!.id,
              quantity: target.quantity,
              allocatedOn: plan.date,
              notes: NOTE,
              updatedAt: new Date(),
            })
            .where(eq(allocations.id, allocationId)),
        )
      } else {
        statements.push(
          db.insert(allocations).values({
            id: allocationId,
            regionId: target.regionId,
            manufacturerId: manufacturer!.id,
            phoneId: phone!.id,
            quantity: target.quantity,
            allocatedOn: plan.date,
            notes: NOTE,
            recordedBy: user.id,
          }),
        )
      }
      statements.push(
        db.insert(auditLogs).values(
          auditEntry({
            actorId: user.id,
            actorRole: user.role,
            action: link ? "update" : "create",
            entityType: "allocation",
            entityId: allocationId,
            after: {
              region: regionName,
              supplier: manufacturer!.name,
              phoneType: phone!.phoneType,
              model: phone!.model,
              quantity: target.quantity,
              date: plan.date,
              notes: NOTE,
            },
          }),
        ),
      )
    }
    for (const link of oldLinks) {
      if (touched.has(link.regionId)) continue
      nextLinks.push(link)
      const row = allocationRows.find((item) => item.id === link.allocationId)
      if (!row || row.quantity === 0) continue
      statements.push(
        db.update(allocations).set({ quantity: 0, notes: NOTE, updatedAt: new Date() }).where(eq(allocations.id, link.allocationId)),
      )
    }

    for (const row of plan.cash) {
      const region = await findRegion(row.regionId)
      if (!region) throw new ActionError("Choose a region.")
      const lead = await activeLead(region.id)
      const currentSend = await cashSend(region.id, plan.date)
      if (!currentSend && !lead) throw new ActionError(`${region.name} has no active sales lead to receive cash.`)
      const leadId = currentSend?.leadId ?? lead?.id
      if (!leadId) throw new ActionError(`${region.name} has no active sales lead to receive cash.`)
      const named = lead?.id === leadId ? lead : await findUser(leadId)
      const after: AuditJson = { region: region.name, lead: named?.name ?? "Sales lead", date: plan.date, sent: row.amount }
      if (!currentSend) {
        const id = randomUUID()
        statements.push(
          db.insert(cashSends).values({
            id,
            regionId: region.id,
            leadId,
            sendDate: plan.date,
            amount: row.amount,
            reference: id,
            recordedBy: user.id,
          }),
        )
        statements.push(
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id,
              actorRole: user.role,
              action: "create",
              entityType: "cash_sent",
              entityId: id,
              after,
            }),
          ),
        )
      } else if (currentSend.amount !== row.amount) {
        statements.push(
          db
            .update(cashSends)
            .set({ amount: row.amount, recordedBy: user.id, updatedAt: new Date() })
            .where(eq(cashSends.id, currentSend.id)),
        )
        statements.push(
          db.insert(auditLogs).values(
            auditEntry({
              actorId: user.id,
              actorRole: user.role,
              action: "update",
              entityType: "cash_sent",
              entityId: currentSend.id,
              before: { region: region.name, lead: named?.name ?? "Sales lead", date: plan.date, sent: currentSend.amount },
              after,
            }),
          ),
        )
      }
    }

    const savedId = existing?.id ?? randomUUID()
    const values = {
      status: "submitted",
      supplierId: plan.supplierId,
      phoneId: plan.phoneId,
      quantity: plan.quantity,
      sends: plan.sends,
      cash: plan.cash,
      receiptId,
      allocations: nextLinks,
      recordedBy: user.id,
      updatedAt: new Date(),
    }
    if (!existing) {
      statements.push(db.insert(dailySetups).values({ id: savedId, setupDate: plan.date, ...values }))
    } else {
      statements.push(db.update(dailySetups).set(values).where(eq(dailySetups.id, existing.id)))
    }

    await commit(statements)
    refreshDesk()
    return { ok: true }
  })
}

async function storePlan(
  userId: string,
  plan: ReturnType<typeof readPlan>,
  status: "draft" | "submitted",
) {
  if (plan.phoneId) {
    const phone = await findSupplierPhone(plan.phoneId)
    if (!phone || (plan.supplierId && phone.supplierId !== plan.supplierId)) {
      throw new ActionError("Choose a phone type and model from that supplier.")
    }
  }
  if (plan.supplierId) {
    const supplier = await findManufacturer(plan.supplierId)
    if (!supplier?.active) throw new ActionError("Choose an active supplier.")
  }
  const db = getDb()
  const existing = await dailySetup(plan.date)
  const values = {
    status: existing?.status === "submitted" ? existing.status : status,
    supplierId: plan.supplierId,
    phoneId: plan.phoneId,
    quantity: plan.quantity,
    sends: plan.sends,
    cash: plan.cash,
    recordedBy: userId,
    updatedAt: new Date(),
  }
  if (!existing) {
    await db.insert(dailySetups).values({ id: randomUUID(), setupDate: plan.date, ...values })
    return
  }
  await db.update(dailySetups).set(values).where(eq(dailySetups.id, existing.id))
}

function readPlan(input: DailySetupInput, strict: boolean) {
  const date = parseDate(input.date)
  const supplierId = input.supplierId.trim()
  const phoneId = input.phoneId.trim()
  const quantityRaw = input.quantity.trim()
  const started = Boolean(supplierId || phoneId || quantityRaw)
  if (strict && started && (!supplierId || !phoneId || !quantityRaw)) {
    throw new ActionError("Choose the supplier, phone type, model, and quantity, or skip the supplier step.")
  }
  const quantity = quantityRaw ? parseWholeNumber(quantityRaw, "Quantity", { max: 1_000_000 }) : null
  if (strict && started && (quantity ?? 0) < 1) throw new ActionError("Enter the number of phones received.")
  const sends = input.sends.flatMap((row) => {
    const amount = row.quantity.trim()
    if (!amount) return []
    const sent = parseWholeNumber(amount, "Phones for a region", { max: 1_000_000 })
    if (sent === 0) return []
    return [{ regionId: row.regionId, quantity: sent }]
  })
  const sentTotal = sends.reduce((sum, row) => sum + row.quantity, 0)
  if (strict && started && sentTotal > (quantity ?? 0)) {
    throw new ActionError("That sends more phones than were received from the supplier.")
  }
  const cash = input.cash.flatMap((row) => {
    const amount = row.amount.trim()
    if (!amount) return []
    return [{ regionId: row.regionId, amount: parseWholeNumber(amount, "Cash") }]
  })
  return { date, supplierId: supplierId || null, phoneId: phoneId || null, quantity, sends, cash, started }
}

function assertCentral(
  central: Awaited<ReturnType<typeof loadCentralMovements>>,
  nextSupplierId: string | undefined,
  previousSupplierId: string | undefined,
  previousReceipt: number,
  previousAllocated: number,
  receiptQty: number,
  targetSum: number,
) {
  const pool = (id: string) => ({
    received: central.receipts.filter((row) => row.manufacturerId === id).reduce((sum, row) => sum + row.quantity, 0),
    allocated: central.allocations.filter((row) => row.manufacturerId === id).reduce((sum, row) => sum + row.quantity, 0),
  })
  if (previousSupplierId && nextSupplierId && previousSupplierId !== nextSupplierId) {
    const previous = pool(previousSupplierId)
    const next = pool(nextSupplierId)
    if (centralRemaining(previous.received - previousReceipt, previous.allocated - previousAllocated) < 0) {
      throw new ActionError("Those phones are already allocated from the previous supplier.")
    }
    if (centralRemaining(next.received + receiptQty, next.allocated + targetSum) < 0) {
      throw new ActionError("Central stock does not have that many phones left to move.")
    }
    return
  }
  const supplierId = nextSupplierId ?? previousSupplierId
  if (!supplierId) return
  const current = pool(supplierId)
  if (centralRemaining(current.received - previousReceipt + receiptQty, current.allocated - previousAllocated + targetSum) < 0) {
    throw new ActionError("Central stock does not have that many phones left to move.")
  }
}

async function regionsOnHand(
  date: string,
  activeSupplierIds: string[],
  stock: Awaited<ReturnType<typeof loadStockMovements>>,
  links: { regionId: string; allocationId: string }[],
  allocationRows: { id: string; regionId: string; quantity: number }[],
) {
  const regions = await listRegions()
  return regions.map((region) => {
    const onHand = activeSupplierIds.reduce((sum, supplierId) => {
      return (
        sum +
        stockCell({
          manufacturerId: supplierId,
          date,
          openings: openingsForRegion(stock.openings, region.id),
          allocations: movementsForRegion(stock.allocations, region.id),
          sales: movementsForRegion(stock.sales, region.id),
        }).onHand
      )
    }, 0)
    const setupQty = links
      .filter((link) => link.regionId === region.id)
      .reduce((sum, link) => sum + (allocationRows.find((row) => row.id === link.allocationId)?.quantity ?? 0), 0)
    return { id: region.id, name: region.name, remaining: onHand - setupQty }
  })
}

function receiptAudit(
  supplier: string,
  phone: { phoneType: string; model: string },
  quantity: number,
  date: string,
): AuditJson {
  return { supplier, phoneType: phone.phoneType, model: phone.model, quantity, date, notes: NOTE }
}
