"use server"

import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { auditEntry, sameJson } from "@/lib/audit"
import { commit } from "@/lib/commit"
import { activeLead, cashDay, cashSend, findRegion, nextCashDay, previousCashDay } from "@/lib/data"
import { getDb } from "@/lib/db"
import { auditLogs, cashDays, cashSends, type AuditJson } from "@/lib/db/schema"
import { ActionError, type ActionState } from "@/lib/errors"
import { field, parseDate, parseWholeNumber } from "@/lib/form"
import { guard } from "@/lib/guard"
import { refreshDesk } from "@/lib/refresh"
import { assertAdmin, assertCashAccess, assertRegionAccess, requireUser } from "@/lib/session"

export async function saveCashDay(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    assertCashAccess(user)
    const regionId = user.role === "ADMIN" ? field(formData, "regionId") : user.regionId
    if (!regionId) throw new ActionError("Choose a region.")
    assertRegionAccess(user, regionId)
    const region = await findRegion(regionId)
    if (!region) throw new ActionError("Choose a region.")
    const date = parseDate(field(formData, "date"))
    const previous = await previousCashDay(region.id, date)
    if (previous && previous.closingBalance === null) {
      throw new ActionError(
        `Enter the closing balance for ${previous.cashDate} before recording cash on ${date}.`,
      )
    }

    const broughtForward =
      previous?.closingBalance !== null && previous?.closingBalance !== undefined
        ? previous.closingBalance
        : parseWholeNumber(field(formData, "broughtForward"), "Balance brought forward")
    const cashReceived = parseWholeNumber(field(formData, "cashReceived"), "Cash received")
    const closingRaw = field(formData, "closingBalance")
    const closingBalance = closingRaw
      ? parseWholeNumber(closingRaw, "Closing balance")
      : null
    const current = await cashDay(region.id, date)
    const next = await nextCashDay(region.id, date)
    if (current?.closingBalance !== null && current?.closingBalance !== undefined && closingBalance === null && next) {
      throw new ActionError("This day already carries into the next one, so the closing balance has to stay filled in.")
    }

    const before: AuditJson | null = current
      ? cashSnapshot(region.name, date, current.balanceBroughtForward, current.cashReceived, current.closingBalance)
      : null
    const after = cashSnapshot(region.name, date, broughtForward, cashReceived, closingBalance)
    const db = getDb()
    const statements = []

    if (!current) {
      const id = randomUUID()
      statements.push(
        db.insert(cashDays).values({
          id,
          regionId: region.id,
          cashDate: date,
          balanceBroughtForward: broughtForward,
          cashReceived,
          closingBalance,
          recordedBy: user.id,
        }),
      )
      statements.push(
        db.insert(auditLogs).values(
          auditEntry({ actorId: user.id, actorRole: user.role, action: "create", entityType: "cash_day", entityId: id, after }),
        ),
      )
    } else if (!before || !sameJson(before, after)) {
      statements.push(
        db
          .update(cashDays)
          .set({
            balanceBroughtForward: broughtForward,
            cashReceived,
            closingBalance,
            recordedBy: user.id,
            updatedAt: new Date(),
          })
          .where(eq(cashDays.id, current.id)),
      )
      statements.push(
        db.insert(auditLogs).values(
          auditEntry({
            actorId: user.id, actorRole: user.role,
            action: "update",
            entityType: "cash_day",
            entityId: current.id,
            before,
            after,
          }),
        ),
      )
    }

    if (closingBalance !== null && next && next.balanceBroughtForward !== closingBalance) {
      const nextBefore = cashSnapshot(
        region.name,
        next.cashDate,
        next.balanceBroughtForward,
        next.cashReceived,
        next.closingBalance,
      )
      const nextAfter = cashSnapshot(
        region.name,
        next.cashDate,
        closingBalance,
        next.cashReceived,
        next.closingBalance,
      )
      statements.push(
        db
          .update(cashDays)
          .set({ balanceBroughtForward: closingBalance, updatedAt: new Date() })
          .where(eq(cashDays.id, next.id)),
      )
      statements.push(
        db.insert(auditLogs).values(
          auditEntry({
            actorId: user.id, actorRole: user.role,
            action: "update",
            entityType: "cash_day",
            entityId: next.id,
            before: nextBefore,
            after: nextAfter,
          }),
        ),
      )
    }

    await commit(statements)
    refreshDesk()
    return { ok: true }
  })
}

export async function saveCashSent(_state: ActionState, formData: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireUser()
    assertAdmin(user)
    const region = await findRegion(field(formData, "regionId"))
    if (!region) throw new ActionError("Choose a region.")
    const date = parseDate(field(formData, "date"))
    const amount = parseWholeNumber(field(formData, "amount"), "Cash sent")
    const lead = await activeLead(region.id)
    const current = await cashSend(region.id, date)
    if (!current && !lead) {
      throw new ActionError(`${region.name} has no active sales lead to receive cash.`)
    }
    const leadId = current?.leadId ?? lead?.id
    if (!leadId) throw new ActionError(`${region.name} has no active sales lead to receive cash.`)
    const leadName = lead && lead.id === leadId ? lead.name : "Sales lead"
    const before: AuditJson | null = current
      ? { region: region.name, lead: leadName, date, sent: current.amount }
      : null
    const after: AuditJson = { region: region.name, lead: leadName, date, sent: amount }
    if (before && sameJson(before, after)) return { ok: true }

    const db = getDb()
    if (!current) {
      const id = randomUUID()
      await commit([
        db.insert(cashSends).values({
          id,
          regionId: region.id,
          leadId,
          sendDate: date,
          amount,
          reference: id,
          recordedBy: user.id,
        }),
        db.insert(auditLogs).values(
          auditEntry({ actorId: user.id, actorRole: user.role, action: "create", entityType: "cash_sent", entityId: id, after }),
        ),
      ])
    } else {
      await commit([
        db
          .update(cashSends)
          .set({ amount, recordedBy: user.id, updatedAt: new Date() })
          .where(eq(cashSends.id, current.id)),
        db.insert(auditLogs).values(
          auditEntry({
            actorId: user.id, actorRole: user.role,
            action: "update",
            entityType: "cash_sent",
            entityId: current.id,
            before,
            after,
          }),
        ),
      ])
    }

    refreshDesk()
    return { ok: true }
  })
}

function cashSnapshot(
  region: string,
  date: string,
  broughtForward: number,
  received: number,
  closing: number | null,
): AuditJson {
  return {
    region,
    date,
    broughtForward,
    received,
    closing,
  }
}
