import assert from "node:assert/strict"
import test from "node:test"
import {
  availableToSell,
  cashGap,
  centralRemaining,
  closingStock,
  depositGap,
  expectedDeposits,
  startingCash,
  stockCell,
  transactionAmount,
} from "./books"
import { monthRange, weekRange } from "./dates"

test("deposit cash follows the worked example", () => {
  const broughtForward = 20_000
  const received = 100_000
  const starting = startingCash(broughtForward, received)
  assert.equal(starting, 120_000)
  assert.equal(cashGap(100_000, 100_000), 0)

  const expected = expectedDeposits([{ quantity: 25, price: 3_900 }])
  assert.equal(expected, 97_500)
  assert.equal(expectedDeposits([{ quantity: 10, price: 3_900 }]), 39_000)

  const closing = 22_500
  const transaction = transactionAmount(starting, closing)
  assert.equal(transaction, 97_500)
  assert.equal(depositGap(transaction, expected), 0)
  assert.equal(closing, 22_500)
})

test("daily stock closes from opening, receipts, and sales", () => {
  const cell = stockCell({
    manufacturerId: "jill",
    date: "2026-10-13",
    openings: [
      { manufacturerId: "jill", date: "2026-10-12", quantity: 30 },
      { manufacturerId: "jill", date: "2026-10-13", quantity: 28 },
    ],
    allocations: [
      { manufacturerId: "jill", date: "2026-10-12", quantity: 0 },
      { manufacturerId: "jill", date: "2026-10-13", quantity: 10 },
    ],
    sales: [
      { manufacturerId: "jill", date: "2026-10-12", quantity: 2 },
      { manufacturerId: "jill", date: "2026-10-13", quantity: 25 },
    ],
  })

  assert.equal(cell.opening, 28)
  assert.equal(cell.received, 10)
  assert.equal(cell.sold, 25)
  assert.equal(cell.closing, closingStock(28, 10, 25))
  assert.equal(cell.suggested, 28)
  assert.equal(cell.onHand, 10 + 0 - 27)
})

test("suggested opening carries movements across a day with no count", () => {
  const cell = stockCell({
    manufacturerId: "kwik",
    date: "2026-10-15",
    openings: [{ manufacturerId: "kwik", date: "2026-10-13", quantity: 10 }],
    allocations: [{ manufacturerId: "kwik", date: "2026-10-14", quantity: 4 }],
    sales: [{ manufacturerId: "kwik", date: "2026-10-14", quantity: 1 }],
  })

  assert.equal(cell.opening, null)
  assert.equal(cell.closing, null)
  assert.equal(cell.suggested, 13)
})

test("available stock uses the daily count once opening is recorded", () => {
  assert.equal(
    availableToSell({
      opening: 20,
      receivedToday: 5,
      soldByOthersToday: 7,
      onHandIfThisLineIsZero: 100,
    }),
    18,
  )
  assert.equal(
    availableToSell({
      opening: null,
      receivedToday: 5,
      soldByOthersToday: 7,
      onHandIfThisLineIsZero: 9,
    }),
    9,
  )
})

test("central stock is receipts less allocations", () => {
  assert.equal(centralRemaining(80, 50), 30)
})

test("reporting periods use Monday weeks and calendar months", () => {
  assert.deepEqual(weekRange("2026-10-13"), { start: "2026-10-12", end: "2026-10-18" })
  assert.deepEqual(monthRange("2026-10-13"), { start: "2026-10-01", end: "2026-10-31" })
})
