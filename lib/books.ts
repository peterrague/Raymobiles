export type DatedQty = {
  manufacturerId: string
  date: string
  quantity: number
}

export type OpeningRow = DatedQty

export function startingCash(broughtForward: number, received: number) {
  return broughtForward + received
}

export function transactionAmount(starting: number, closing: number) {
  return starting - closing
}

export function expectedDeposits(lines: { quantity: number; price: number }[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.price, 0)
}

export function expectedFromLines(lines: { quantity: number; price: number | null }[]) {
  let expected = 0
  let incomplete = false
  for (const line of lines) {
    if (line.price === null) {
      if (line.quantity > 0) incomplete = true
      continue
    }
    expected += line.quantity * line.price
  }
  return { expected, incomplete }
}

export function closingStock(opening: number, received: number, sold: number) {
  return opening + received - sold
}

export function centralRemaining(received: number, allocated: number) {
  return received - allocated
}

export function onHand(allocated: number, sold: number) {
  return allocated - sold
}

/** Lead's recorded cash minus the amount the admin logged as sent. */
export function cashGap(sent: number, received: number) {
  return received - sent
}

/** Cash used for deposits minus the deposits expected from units sold. */
export function depositGap(transaction: number, expected: number) {
  return transaction - expected
}

export function availableToSell(input: {
  opening: number | null
  receivedToday: number
  soldByOthersToday: number
  onHandIfThisLineIsZero: number
}) {
  if (input.opening !== null) {
    return input.opening + input.receivedToday - input.soldByOthersToday
  }
  return input.onHandIfThisLineIsZero
}

export function sumBetween(rows: DatedQty[], manufacturerId: string, start: string, end: string) {
  return rows.reduce((sum, row) => {
    if (row.manufacturerId !== manufacturerId) return sum
    if (row.date < start || row.date > end) return sum
    return sum + row.quantity
  }, 0)
}

export function stockCell(input: {
  manufacturerId: string
  date: string
  openings: OpeningRow[]
  allocations: DatedQty[]
  sales: DatedQty[]
}) {
  const { manufacturerId, date } = input
  const openingToday =
    input.openings.find((row) => row.manufacturerId === manufacturerId && row.date === date)
      ?.quantity ?? null
  const receivedToday = sumBetween(input.allocations, manufacturerId, date, date)
  const soldToday = sumBetween(input.sales, manufacturerId, date, date)
  const allocatedToDate = sumBetween(input.allocations, manufacturerId, "0000-01-01", date)
  const soldToDate = sumBetween(input.sales, manufacturerId, "0000-01-01", date)
  const prior = input.openings
    .filter((row) => row.manufacturerId === manufacturerId && row.date < date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  const dayBefore = previousDate(date)
  const suggested =
    prior === undefined
      ? null
      : prior.quantity +
        sumBetween(input.allocations, manufacturerId, prior.date, dayBefore) -
        sumBetween(input.sales, manufacturerId, prior.date, dayBefore)

  return {
    opening: openingToday,
    received: receivedToday,
    sold: soldToday,
    closing: openingToday === null ? null : closingStock(openingToday, receivedToday, soldToday),
    onHand: onHand(allocatedToDate, soldToDate),
    suggested,
  }
}

function previousDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}
