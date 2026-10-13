import { addDays } from "./dates"
import { businessToday } from "./today"
import type {
  AuditJson,
  DbUser,
  cashDays,
  cashSends,
  dailyOpenings,
  dailyPrices,
  manufacturers,
  regions,
  sales,
} from "./db/schema"

const STAMP = new Date("2026-10-01T06:00:00.000Z")

const jill = "11111111-1111-4111-8111-111111111111"
const kwik = "22222222-2222-4222-8222-222222222222"
const mombasa = "33333333-3333-4333-8333-333333333333"
const nyandarua = "44444444-4444-4444-8444-444444444444"
const adminId = "55555555-5555-4555-8555-555555555555"
const leadM = "66666666-6666-4666-8666-666666666666"
const agentM = "77777777-7777-4777-8777-777777777777"
const leadN = "88888888-8888-4888-8888-888888888888"
const agentN = "99999999-9999-4999-8999-999999999999"

type Manufacturer = typeof manufacturers.$inferSelect
type Region = typeof regions.$inferSelect
type Price = typeof dailyPrices.$inferSelect
type Opening = typeof dailyOpenings.$inferSelect
type Sale = typeof sales.$inferSelect
type CashDay = typeof cashDays.$inferSelect
type CashSend = typeof cashSends.$inferSelect

type ReportSale = {
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

type ReportCash = {
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

type StockMovement = {
  regionId: string
  manufacturerId: string
  date: string
  quantity: number
}

function person(input: Pick<DbUser, "id" | "email" | "name" | "role" | "regionId" | "leadId">): DbUser {
  return {
    ...input,
    image: null,
    active: true,
    createdAt: STAMP,
    updatedAt: STAMP,
  }
}

const people: DbUser[] = [
  person({
    id: adminId,
    email: "preview@batrobas.local",
    name: "Preview",
    role: "ADMIN",
    regionId: null,
    leadId: null,
  }),
  person({
    id: leadM,
    email: "mombasa.lead@batrobas.local",
    name: "Asha Hassan",
    role: "SALES_LEAD",
    regionId: mombasa,
    leadId: null,
  }),
  person({
    id: agentM,
    email: "mombasa.agent@batrobas.local",
    name: "Peter Njoroge",
    role: "SALES_AGENT",
    regionId: mombasa,
    leadId: leadM,
  }),
  person({
    id: leadN,
    email: "nyandarua.lead@batrobas.local",
    name: "Grace Wanjiru",
    role: "SALES_LEAD",
    regionId: nyandarua,
    leadId: null,
  }),
  person({
    id: agentN,
    email: "nyandarua.agent@batrobas.local",
    name: "David Kamau",
    role: "SALES_AGENT",
    regionId: nyandarua,
    leadId: leadN,
  }),
]

const manufacturerRows: Manufacturer[] = [
  { id: jill, name: "Jill Multichoice", active: true, createdAt: STAMP },
  { id: kwik, name: "Kwikhand Enterprise", active: true, createdAt: STAMP },
]

const regionRows: Region[] = [
  { id: mombasa, name: "Mombasa", createdAt: STAMP },
  { id: nyandarua, name: "Nyandarua", createdAt: STAMP },
]

type World = ReturnType<typeof buildWorld>

let cached: { day: string; world: World } | undefined

async function world() {
  const day = await businessToday()
  if (cached?.day !== day) cached = { day, world: buildWorld(day) }
  return cached.world
}

function buildWorld(today: string) {
  const days = [addDays(today, -2), addDays(today, -1), today]
  const prices: Price[] = []
  const openings: Opening[] = []
  const saleRows: Sale[] = []
  const cash: CashDay[] = []
  const sends: CashSend[] = []

  for (const date of days) {
    for (const regionId of [mombasa, nyandarua]) {
      for (const manufacturerId of [jill, kwik]) {
        const price = manufacturerId === jill ? 3900 : 4100
        prices.push({
          id: `price-${regionId}-${manufacturerId}-${date}`,
          regionId,
          manufacturerId,
          priceDate: date,
          unitPrice: price,
          recordedBy: regionId === mombasa ? leadM : leadN,
          createdAt: STAMP,
          updatedAt: STAMP,
        })
      }
    }
  }

  const openingPlan: [string, string, number, number, number][] = [
    [mombasa, jill, 55, 47, 40],
    [mombasa, kwik, 18, 16, 16],
    [nyandarua, jill, 28, 24, 20],
    [nyandarua, kwik, 12, 12, 12],
  ]
  openingPlan.forEach(([regionId, manufacturerId, a, b, c], index) => {
    ;[a, b, c].forEach((quantity, dayIndex) => {
      openings.push({
        id: `open-${index}-${dayIndex}`,
        regionId,
        manufacturerId,
        stockDate: days[dayIndex],
        openingQty: quantity,
        recordedBy: regionId === mombasa ? leadM : leadN,
        createdAt: STAMP,
        updatedAt: STAMP,
      })
    })
  })

  const salePlan: [string, string, string, number, number, number][] = [
    [mombasa, jill, leadM, 5, 4, 10],
    [mombasa, jill, agentM, 3, 3, 15],
    [mombasa, kwik, agentM, 2, 2, 0],
    [nyandarua, jill, leadN, 2, 2, 6],
    [nyandarua, jill, agentN, 2, 2, 2],
    [nyandarua, kwik, leadN, 0, 1, 0],
  ]
  salePlan.forEach(([regionId, manufacturerId, agentId, a, b, c], index) => {
    ;[a, b, c].forEach((quantity, dayIndex) => {
      if (quantity === 0) return
      saleRows.push({
        id: `sale-${index}-${dayIndex}`,
        regionId,
        manufacturerId,
        agentId,
        saleDate: days[dayIndex],
        quantity,
        recordedBy: agentId,
        createdAt: STAMP,
        updatedAt: STAMP,
      })
    })
  })

  const cashPlan: [string, number, number, number, number][] = [
    [mombasa, 12000, 40000, 15000, 40000],
    [mombasa, 15000, 80000, 20000, 80000],
    [mombasa, 20000, 100000, 22500, 100000],
    [nyandarua, 5000, 30000, 8000, 30000],
    [nyandarua, 8000, 35000, 8000, 35000],
    [nyandarua, 8000, 40000, 16800, 40000],
  ]
  cashPlan.forEach(([regionId, brought, received, closing, sent], index) => {
    const dayIndex = index % 3
    const date = days[dayIndex]
    const leadId = regionId === mombasa ? leadM : leadN
    cash.push({
      id: `cash-${regionId}-${dayIndex}`,
      regionId,
      cashDate: date,
      balanceBroughtForward: brought,
      cashReceived: received,
      closingBalance: closing,
      recordedBy: leadId,
      createdAt: STAMP,
      updatedAt: STAMP,
    })
    sends.push({
      id: `send-${regionId}-${dayIndex}`,
      regionId,
      leadId,
      sendDate: date,
      amount: sent,
      recordedBy: adminId,
      createdAt: STAMP,
      updatedAt: STAMP,
    })
  })

  const allocationRows = [
    { id: "alloc-1", regionId: mombasa, manufacturerId: jill, date: days[0], quantity: 70, notes: null },
    { id: "alloc-2", regionId: mombasa, manufacturerId: jill, date: today, quantity: 10, notes: "Morning delivery" },
    { id: "alloc-3", regionId: mombasa, manufacturerId: kwik, date: days[0], quantity: 24, notes: null },
    { id: "alloc-4", regionId: nyandarua, manufacturerId: jill, date: days[0], quantity: 40, notes: null },
    { id: "alloc-5", regionId: nyandarua, manufacturerId: kwik, date: days[0], quantity: 16, notes: null },
  ]
  const receipts = [
    { id: "rcpt-1", manufacturerId: jill, date: days[0], quantity: 200, notes: "Container from Jill Multichoice" },
    { id: "rcpt-2", manufacturerId: kwik, date: days[0], quantity: 90, notes: null },
  ]

  const names = new Map(people.map((user) => [user.id, user.name]))
  const regionNames = new Map(regionRows.map((region) => [region.id, region.name]))
  const manufacturerNames = new Map(manufacturerRows.map((manufacturer) => [manufacturer.id, manufacturer.name]))

  const reportSales: ReportSale[] = saleRows.map((sale) => ({
    regionId: sale.regionId,
    regionName: regionNames.get(sale.regionId) ?? "",
    manufacturerId: sale.manufacturerId,
    manufacturerName: manufacturerNames.get(sale.manufacturerId) ?? "",
    agentId: sale.agentId,
    agentName: names.get(sale.agentId) ?? "",
    agentActive: true,
    date: sale.saleDate,
    quantity: sale.quantity,
    price: prices.find(
      (price) =>
        price.regionId === sale.regionId &&
        price.manufacturerId === sale.manufacturerId &&
        price.priceDate === sale.saleDate,
    )?.unitPrice ?? null,
  }))

  const reportCash: ReportCash[] = cash.map((day) => {
    const sent = sends.find((send) => send.regionId === day.regionId && send.sendDate === day.cashDate)?.amount ?? null
    const starting = day.balanceBroughtForward + day.cashReceived
    const transaction = day.closingBalance === null ? null : starting - day.closingBalance
    return {
      regionId: day.regionId,
      regionName: regionNames.get(day.regionId) ?? "",
      date: day.cashDate,
      recorded: true,
      broughtForward: day.balanceBroughtForward,
      received: day.cashReceived,
      closing: day.closingBalance,
      starting,
      transaction,
      sent,
      gap: sent === null ? null : day.cashReceived - sent,
    }
  })

  const stockAllocations: StockMovement[] = allocationRows.map((row) => ({
    regionId: row.regionId,
    manufacturerId: row.manufacturerId,
    date: row.date,
    quantity: row.quantity,
  }))
  const stockSales: StockMovement[] = saleRows.map((sale) => ({
    regionId: sale.regionId,
    manufacturerId: sale.manufacturerId,
    date: sale.saleDate,
    quantity: sale.quantity,
  }))
  const stockOpenings: StockMovement[] = openings.map((opening) => ({
    regionId: opening.regionId,
    manufacturerId: opening.manufacturerId,
    date: opening.stockDate,
    quantity: opening.openingQty,
  }))

  return {
    prices,
    openings,
    saleRows,
    cash,
    sends,
    allocationRows,
    receipts,
    reportSales,
    reportCash,
    stockAllocations,
    stockSales,
    stockOpenings,
  }
}

export function previewUser(role: "ADMIN" | "SALES_LEAD" | "SALES_AGENT" = "ADMIN") {
  if (role === "SALES_LEAD") return people[1]
  if (role === "SALES_AGENT") return people[2]
  return people[0]
}

export function previewManufacturers() {
  return manufacturerRows
}

export function previewRegions() {
  return regionRows
}

export function previewUsers() {
  return people
}

export function previewFindUser(id: string) {
  return people.find((user) => user.id === id) ?? null
}

export function previewFindRegion(id: string) {
  return regionRows.find((region) => region.id === id) ?? null
}

export function previewFindManufacturer(id: string) {
  return manufacturerRows.find((manufacturer) => manufacturer.id === id) ?? null
}

export function previewFindByName(table: "regions" | "manufacturers", name: string, exceptId?: string) {
  const rows = table === "regions" ? regionRows : manufacturerRows
  return rows.find((row) => row.name.toLowerCase() === name.toLowerCase() && row.id !== exceptId) ?? null
}

export async function previewCentral() {
  const books = await world()
  return {
    receipts: books.receipts,
    allocations: books.allocationRows.map((row) => ({
      manufacturerId: row.manufacturerId,
      quantity: row.quantity,
    })),
  }
}

export async function previewAllocations() {
  return (await world()).allocationRows
}

export async function previewStock() {
  const books = await world()
  return {
    allocations: books.stockAllocations,
    sales: books.stockSales,
    openings: books.stockOpenings,
  }
}

export function previewSellers(regionId: string) {
  return people
    .filter((user) => user.regionId === regionId && user.active && user.role !== "ADMIN")
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function previewDayPrices(regionId: string, date: string) {
  return (await world()).prices.filter((price) => price.regionId === regionId && price.priceDate === date)
}

export async function previewDaySales(regionId: string, date: string) {
  return (await world()).saleRows.filter((sale) => sale.regionId === regionId && sale.saleDate === date)
}

export async function previewAgentSale(agentId: string, manufacturerId: string, date: string) {
  return (
    (await world()).saleRows.find(
      (sale) => sale.agentId === agentId && sale.manufacturerId === manufacturerId && sale.saleDate === date,
    ) ?? null
  )
}

export async function previewOpening(regionId: string, manufacturerId: string, date: string) {
  return (
    (await world()).openings.find(
      (opening) =>
        opening.regionId === regionId && opening.manufacturerId === manufacturerId && opening.stockDate === date,
    ) ?? null
  )
}

export async function previewPrice(regionId: string, manufacturerId: string, date: string) {
  return (
    (await world()).prices.find(
      (price) => price.regionId === regionId && price.manufacturerId === manufacturerId && price.priceDate === date,
    ) ?? null
  )
}

export async function previewCashDay(regionId: string, date: string) {
  return (await world()).cash.find((day) => day.regionId === regionId && day.cashDate === date) ?? null
}

export async function previewPreviousCash(regionId: string, date: string) {
  return (
    (await world()).cash.filter((day) => day.regionId === regionId && day.cashDate < date).sort((a, b) =>
      a.cashDate < b.cashDate ? 1 : -1,
    )[0] ?? null
  )
}

export async function previewNextCash(regionId: string, date: string) {
  return (
    (await world()).cash.filter((day) => day.regionId === regionId && day.cashDate > date).sort((a, b) =>
      a.cashDate < b.cashDate ? -1 : 1,
    )[0] ?? null
  )
}

export async function previewCashSend(regionId: string, date: string) {
  return (await world()).sends.find((send) => send.regionId === regionId && send.sendDate === date) ?? null
}

export function previewActiveLead(regionId: string) {
  return people.find((user) => user.regionId === regionId && user.role === "SALES_LEAD" && user.active) ?? null
}

export function previewAdminCount(exceptId?: string) {
  return people.filter((user) => user.role === "ADMIN" && user.active && user.id !== exceptId).length
}

export async function previewReport(input: {
  start: string
  end: string
  regionId?: string
  agentId?: string
  includeCash: boolean
}) {
  const books = await world()
  const sales = books.reportSales
    .filter((sale) => sale.date >= input.start && sale.date <= input.end)
    .filter((sale) => (input.regionId ? sale.regionId === input.regionId : true))
    .filter((sale) => (input.agentId ? sale.agentId === input.agentId : true))
    .map((sale) => (input.includeCash ? sale : { ...sale, price: null }))
  if (!input.includeCash) return { sales, cash: [] as ReportCash[] }
  const cash = books.reportCash
    .filter((day) => day.date >= input.start && day.date <= input.end)
    .filter((day) => (input.regionId ? day.regionId === input.regionId : true))
    .sort((a, b) => a.date.localeCompare(b.date) || a.regionName.localeCompare(b.regionName))
  return { sales, cash }
}

export async function previewAudit() {
  const today = await businessToday()
  return [
    {
      id: "audit-1",
      action: "create",
      entityType: "cash_sent",
      entityId: "send-today",
      before: null,
      after: { region: "Mombasa", date: today, sent: 100000 } as AuditJson,
      createdAt: STAMP,
      actorName: "Preview",
    },
    {
      id: "audit-2",
      action: "update",
      entityType: "daily_price",
      entityId: "price-today",
      before: { region: "Mombasa", manufacturer: "Jill Multichoice", date: today, deposit: 3800 } as AuditJson,
      after: { region: "Mombasa", manufacturer: "Jill Multichoice", date: today, deposit: 3900 } as AuditJson,
      createdAt: STAMP,
      actorName: "Asha Hassan",
    },
    {
      id: "audit-3",
      action: "create",
      entityType: "sale",
      entityId: "sale-today",
      before: null,
      after: {
        region: "Mombasa",
        manufacturer: "Jill Multichoice",
        agent: "Peter Njoroge",
        date: today,
        quantity: 15,
      } as AuditJson,
      createdAt: STAMP,
      actorName: "Peter Njoroge",
    },
  ]
}
