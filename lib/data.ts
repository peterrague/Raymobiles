import "server-only"
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm"
import {
  cashGap,
  expectedFromLines,
  startingCash,
  transactionAmount,
  type DatedQty,
  type OpeningRow,
} from "./books"
import * as demo from "./demo"
import { getDb } from "./db"
import { isPreview } from "./preview"
import {
  allocations,
  auditLogs,
  cashDays,
  cashSends,
  centralReceipts,
  dailyOpenings,
  dailyPrices,
  manufacturers,
  regions,
  sales,
  users,
} from "./db/schema"

export async function listManufacturers() {
  if (await isPreview()) return demo.previewManufacturers()
  return getDb().select().from(manufacturers).orderBy(asc(manufacturers.name))
}

export async function listRegions() {
  if (await isPreview()) return demo.previewRegions()
  return getDb().select().from(regions).orderBy(asc(regions.name))
}

export async function listUsers() {
  if (await isPreview()) return demo.previewUsers()
  return getDb().select().from(users).orderBy(asc(users.name))
}

export async function findUser(id: string) {
  if (await isPreview()) return demo.previewFindUser(id)
  const [user] = await getDb().select().from(users).where(eq(users.id, id)).limit(1)
  return user ?? null
}

export async function findRegion(id: string) {
  if (await isPreview()) return demo.previewFindRegion(id)
  const [region] = await getDb().select().from(regions).where(eq(regions.id, id)).limit(1)
  return region ?? null
}

export async function findManufacturer(id: string) {
  if (await isPreview()) return demo.previewFindManufacturer(id)
  const [manufacturer] = await getDb()
    .select()
    .from(manufacturers)
    .where(eq(manufacturers.id, id))
    .limit(1)
  return manufacturer ?? null
}

export async function findByName(
  table: "regions" | "manufacturers",
  name: string,
  exceptId?: string,
) {
  if (await isPreview()) return demo.previewFindByName(table, name, exceptId)
  const source = table === "regions" ? regions : manufacturers
  const rows = await getDb()
    .select()
    .from(source)
    .where(sql`lower(${source.name}) = ${name.toLowerCase()}`)
  return rows.find((row) => row.id !== exceptId) ?? null
}

export async function loadCentralMovements() {
  if (await isPreview()) return demo.previewCentral()
  const db = getDb()
  const [receiptRows, allocationRows] = await Promise.all([
    db
      .select({
        id: centralReceipts.id,
        manufacturerId: centralReceipts.manufacturerId,
        date: centralReceipts.receivedOn,
        quantity: centralReceipts.quantity,
        notes: centralReceipts.notes,
      })
      .from(centralReceipts)
      .orderBy(desc(centralReceipts.receivedOn), desc(centralReceipts.createdAt)),
    db
      .select({
        manufacturerId: allocations.manufacturerId,
        quantity: allocations.quantity,
      })
      .from(allocations),
  ])
  return { receipts: receiptRows, allocations: allocationRows }
}

export async function loadAllocationRows() {
  if (await isPreview()) return demo.previewAllocations()
  return getDb()
    .select({
      id: allocations.id,
      regionId: allocations.regionId,
      manufacturerId: allocations.manufacturerId,
      date: allocations.allocatedOn,
      quantity: allocations.quantity,
      notes: allocations.notes,
    })
    .from(allocations)
    .orderBy(desc(allocations.allocatedOn), desc(allocations.createdAt))
}

export type StockMovement = {
  regionId: string
  manufacturerId: string
  date: string
  quantity: number
}

export async function loadStockMovements() {
  if (await isPreview()) return demo.previewStock()
  const db = getDb()
  const [allocationRows, saleRows, openingRows] = await Promise.all([
    db
      .select({
        regionId: allocations.regionId,
        manufacturerId: allocations.manufacturerId,
        date: allocations.allocatedOn,
        quantity: allocations.quantity,
      })
      .from(allocations),
    db
      .select({
        regionId: sales.regionId,
        manufacturerId: sales.manufacturerId,
        date: sales.saleDate,
        quantity: sales.quantity,
      })
      .from(sales),
    db
      .select({
        regionId: dailyOpenings.regionId,
        manufacturerId: dailyOpenings.manufacturerId,
        date: dailyOpenings.stockDate,
        quantity: dailyOpenings.openingQty,
      })
      .from(dailyOpenings),
  ])
  return { allocations: allocationRows, sales: saleRows, openings: openingRows }
}

export function movementsForRegion(
  rows: StockMovement[],
  regionId: string,
): DatedQty[] {
  return rows
    .filter((row) => row.regionId === regionId)
    .map(({ manufacturerId, date, quantity }) => ({ manufacturerId, date, quantity }))
}

export function openingsForRegion(rows: StockMovement[], regionId: string): OpeningRow[] {
  return movementsForRegion(rows, regionId)
}

export async function regionSellers(regionId: string) {
  if (await isPreview()) return demo.previewSellers(regionId)
  return getDb()
    .select()
    .from(users)
    .where(
      and(
        eq(users.regionId, regionId),
        eq(users.active, true),
        sql`${users.role} in ('SALES_LEAD', 'SALES_AGENT')`,
      ),
    )
    .orderBy(asc(users.name))
}

export async function dayPrices(regionId: string, date: string) {
  if (await isPreview()) return demo.previewDayPrices(regionId, date)
  return getDb()
    .select()
    .from(dailyPrices)
    .where(and(eq(dailyPrices.regionId, regionId), eq(dailyPrices.priceDate, date)))
}

export async function daySales(regionId: string, date: string) {
  if (await isPreview()) return demo.previewDaySales(regionId, date)
  return getDb()
    .select()
    .from(sales)
    .where(and(eq(sales.regionId, regionId), eq(sales.saleDate, date)))
}

export async function agentSale(agentId: string, manufacturerId: string, date: string) {
  if (await isPreview()) return demo.previewAgentSale(agentId, manufacturerId, date)
  const [row] = await getDb()
    .select()
    .from(sales)
    .where(
      and(eq(sales.agentId, agentId), eq(sales.manufacturerId, manufacturerId), eq(sales.saleDate, date)),
    )
    .limit(1)
  return row ?? null
}

export async function openingRow(regionId: string, manufacturerId: string, date: string) {
  if (await isPreview()) return demo.previewOpening(regionId, manufacturerId, date)
  const [row] = await getDb()
    .select()
    .from(dailyOpenings)
    .where(
      and(
        eq(dailyOpenings.regionId, regionId),
        eq(dailyOpenings.manufacturerId, manufacturerId),
        eq(dailyOpenings.stockDate, date),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function priceRow(regionId: string, manufacturerId: string, date: string) {
  if (await isPreview()) return demo.previewPrice(regionId, manufacturerId, date)
  const [row] = await getDb()
    .select()
    .from(dailyPrices)
    .where(
      and(
        eq(dailyPrices.regionId, regionId),
        eq(dailyPrices.manufacturerId, manufacturerId),
        eq(dailyPrices.priceDate, date),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function cashDay(regionId: string, date: string) {
  if (await isPreview()) return demo.previewCashDay(regionId, date)
  const [row] = await getDb()
    .select()
    .from(cashDays)
    .where(and(eq(cashDays.regionId, regionId), eq(cashDays.cashDate, date)))
    .limit(1)
  return row ?? null
}

export async function previousCashDay(regionId: string, date: string) {
  if (await isPreview()) return demo.previewPreviousCash(regionId, date)
  const [row] = await getDb()
    .select()
    .from(cashDays)
    .where(and(eq(cashDays.regionId, regionId), sql`${cashDays.cashDate} < ${date}`))
    .orderBy(desc(cashDays.cashDate))
    .limit(1)
  return row ?? null
}

export async function nextCashDay(regionId: string, date: string) {
  if (await isPreview()) return demo.previewNextCash(regionId, date)
  const [row] = await getDb()
    .select()
    .from(cashDays)
    .where(and(eq(cashDays.regionId, regionId), sql`${cashDays.cashDate} > ${date}`))
    .orderBy(asc(cashDays.cashDate))
    .limit(1)
  return row ?? null
}

export async function cashSend(regionId: string, date: string) {
  if (await isPreview()) return demo.previewCashSend(regionId, date)
  const [row] = await getDb()
    .select()
    .from(cashSends)
    .where(and(eq(cashSends.regionId, regionId), eq(cashSends.sendDate, date)))
    .limit(1)
  return row ?? null
}

export async function activeLead(regionId: string) {
  if (await isPreview()) return demo.previewActiveLead(regionId)
  const [lead] = await getDb()
    .select()
    .from(users)
    .where(and(eq(users.regionId, regionId), eq(users.role, "SALES_LEAD"), eq(users.active, true)))
    .limit(1)
  return lead ?? null
}

export async function countActiveAdmins(exceptId?: string) {
  if (await isPreview()) return demo.previewAdminCount(exceptId)
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "ADMIN"), eq(users.active, true)))
  return rows.filter((row) => row.id !== exceptId).length
}

export type ReportSale = {
  regionId: string
  regionName: string
  manufacturerId: string
  manufacturerName: string
  agentId: string
  agentName: string
  agentActive: boolean
  date: string
  quantity: number
  price: number | null
}

export type ReportCash = {
  regionId: string
  regionName: string
  date: string
  recorded: boolean
  broughtForward: number
  received: number
  closing: number | null
  starting: number
  transaction: number | null
  sent: number | null
  gap: number | null
}

export async function loadReport(input: {
  start: string
  end: string
  regionId?: string
  agentId?: string
  includeCash: boolean
}) {
  if (await isPreview()) return demo.previewReport(input)
  const db = getDb()
  const saleRows = await db
    .select({
      regionId: sales.regionId,
      regionName: regions.name,
      manufacturerId: sales.manufacturerId,
      manufacturerName: manufacturers.name,
      agentId: sales.agentId,
      agentName: users.name,
      agentActive: users.active,
      date: sales.saleDate,
      quantity: sales.quantity,
    })
    .from(sales)
    .innerJoin(regions, eq(sales.regionId, regions.id))
    .innerJoin(manufacturers, eq(sales.manufacturerId, manufacturers.id))
    .innerJoin(users, eq(sales.agentId, users.id))
    .where(
      and(
        gte(sales.saleDate, input.start),
        lte(sales.saleDate, input.end),
        input.regionId ? eq(sales.regionId, input.regionId) : undefined,
        input.agentId ? eq(sales.agentId, input.agentId) : undefined,
      ),
    )

  if (!input.includeCash) {
    return {
      sales: saleRows.map((row) => ({ ...row, price: null })),
      cash: [] as ReportCash[],
    }
  }

  const priceRows = await db
    .select({
      regionId: dailyPrices.regionId,
      manufacturerId: dailyPrices.manufacturerId,
      date: dailyPrices.priceDate,
      unitPrice: dailyPrices.unitPrice,
    })
    .from(dailyPrices)
    .where(
      and(
        gte(dailyPrices.priceDate, input.start),
        lte(dailyPrices.priceDate, input.end),
        input.regionId ? eq(dailyPrices.regionId, input.regionId) : undefined,
      ),
    )
  const prices = new Map(
    priceRows.map((row) => [`${row.regionId}:${row.manufacturerId}:${row.date}`, row.unitPrice]),
  )
  const reportSales: ReportSale[] = saleRows.map((row) => ({
    ...row,
    price: prices.get(`${row.regionId}:${row.manufacturerId}:${row.date}`) ?? null,
  }))

  const cashRows = await db
    .select({
      regionId: cashDays.regionId,
      regionName: regions.name,
      date: cashDays.cashDate,
      broughtForward: cashDays.balanceBroughtForward,
      received: cashDays.cashReceived,
      closing: cashDays.closingBalance,
    })
    .from(cashDays)
    .innerJoin(regions, eq(cashDays.regionId, regions.id))
    .where(
      and(
        gte(cashDays.cashDate, input.start),
        lte(cashDays.cashDate, input.end),
        input.regionId ? eq(cashDays.regionId, input.regionId) : undefined,
      ),
    )
  const sendRows = await db
    .select({
      regionId: cashSends.regionId,
      regionName: regions.name,
      date: cashSends.sendDate,
      amount: cashSends.amount,
    })
    .from(cashSends)
    .innerJoin(regions, eq(cashSends.regionId, regions.id))
    .where(
      and(
        gte(cashSends.sendDate, input.start),
        lte(cashSends.sendDate, input.end),
        input.regionId ? eq(cashSends.regionId, input.regionId) : undefined,
      ),
    )
  const sent = new Map(sendRows.map((row) => [`${row.regionId}:${row.date}`, row.amount]))
  const cash: ReportCash[] = cashRows.map((row) => {
    const starting = startingCash(row.broughtForward, row.received)
    const sentAmount = sent.get(`${row.regionId}:${row.date}`) ?? null
    return {
      ...row,
      recorded: true,
      starting,
      transaction: row.closing === null ? null : transactionAmount(starting, row.closing),
      sent: sentAmount,
      gap: sentAmount === null ? null : cashGap(sentAmount, row.received),
    }
  })
  for (const send of sendRows) {
    if (cash.some((row) => row.regionId === send.regionId && row.date === send.date)) continue
    cash.push({
      regionId: send.regionId,
      regionName: send.regionName,
      date: send.date,
      recorded: false,
      broughtForward: 0,
      received: 0,
      closing: null,
      starting: 0,
      transaction: null,
      sent: send.amount,
      gap: null,
    })
  }
  cash.sort((a, b) => a.date.localeCompare(b.date) || a.regionName.localeCompare(b.regionName))
  return { sales: reportSales, cash }
}

export function summariseSales(lines: ReportSale[]) {
  const byManufacturer = new Map<string, { name: string; units: number; priced: { quantity: number; price: number | null }[] }>()
  const byAgent = new Map<string, { name: string; active: boolean; regionName: string; units: number; lines: ReportSale[] }>()
  const byRegion = new Map<string, { name: string; units: number; lines: ReportSale[] }>()

  for (const line of lines) {
    const manufacturer = byManufacturer.get(line.manufacturerId) ?? {
      name: line.manufacturerName,
      units: 0,
      priced: [],
    }
    manufacturer.units += line.quantity
    manufacturer.priced.push({ quantity: line.quantity, price: line.price })
    byManufacturer.set(line.manufacturerId, manufacturer)

    const agent = byAgent.get(line.agentId) ?? {
      name: line.agentName,
      active: line.agentActive,
      regionName: line.regionName,
      units: 0,
      lines: [],
    }
    agent.units += line.quantity
    agent.lines.push(line)
    byAgent.set(line.agentId, agent)

    const region = byRegion.get(line.regionId) ?? { name: line.regionName, units: 0, lines: [] }
    region.units += line.quantity
    region.lines.push(line)
    byRegion.set(line.regionId, region)
  }

  return {
    units: lines.reduce((sum, line) => sum + line.quantity, 0),
    deposits: expectedFromLines(lines),
    manufacturers: [...byManufacturer.entries()]
      .map(([id, row]) => ({ id, name: row.name, units: row.units, deposits: expectedFromLines(row.priced) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    agents: [...byAgent.entries()]
      .map(([id, row]) => ({
        id,
        name: row.name,
        active: row.active,
        regionName: row.regionName,
        units: row.units,
        deposits: expectedFromLines(row.lines),
      }))
      .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name)),
    regions: [...byRegion.entries()]
      .map(([id, row]) => ({
        id,
        name: row.name,
        units: row.units,
        deposits: expectedFromLines(row.lines),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export async function recentAudit(limit = 150) {
  if (await isPreview()) return (await demo.previewAudit()).slice(0, limit)
  return getDb()
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      before: auditLogs.before,
      after: auditLogs.after,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
}
