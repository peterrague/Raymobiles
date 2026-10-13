import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"

export const roleEnum = pgEnum("user_role", ["ADMIN", "SALES_LEAD", "SALES_AGENT"])

export const manufacturers = pgTable(
  "manufacturers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("manufacturers_name_lower").on(sql`lower(${table.name})`)],
)

export const regions = pgTable(
  "regions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("regions_name_lower").on(sql`lower(${table.name})`)],
)

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    image: text("image"),
    role: roleEnum("role").notNull(),
    regionId: uuid("region_id").references(() => regions.id),
    leadId: uuid("lead_id").references((): AnyPgColumn => users.id),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_one_active_lead_per_region")
      .on(table.regionId)
      .where(sql`${table.role} = 'SALES_LEAD' AND ${table.active} = true`),
  ],
)

export const centralReceipts = pgTable(
  "central_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manufacturerId: uuid("manufacturer_id")
      .notNull()
      .references(() => manufacturers.id),
    quantity: integer("quantity").notNull(),
    receivedOn: date("received_on", { mode: "string" }).notNull(),
    notes: text("notes"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("central_receipts_quantity_non_negative", sql`${table.quantity} >= 0`)],
)

export const allocations = pgTable(
  "allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    manufacturerId: uuid("manufacturer_id")
      .notNull()
      .references(() => manufacturers.id),
    quantity: integer("quantity").notNull(),
    allocatedOn: date("allocated_on", { mode: "string" }).notNull(),
    notes: text("notes"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("allocations_quantity_non_negative", sql`${table.quantity} >= 0`)],
)

export const dailyPrices = pgTable(
  "daily_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    manufacturerId: uuid("manufacturer_id")
      .notNull()
      .references(() => manufacturers.id),
    priceDate: date("price_date", { mode: "string" }).notNull(),
    unitPrice: integer("unit_price").notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("daily_prices_region_manufacturer_date").on(
      table.regionId,
      table.manufacturerId,
      table.priceDate,
    ),
    check("daily_prices_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
  ],
)

export const dailyOpenings = pgTable(
  "daily_openings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    manufacturerId: uuid("manufacturer_id")
      .notNull()
      .references(() => manufacturers.id),
    stockDate: date("stock_date", { mode: "string" }).notNull(),
    openingQty: integer("opening_qty").notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("daily_openings_region_manufacturer_date").on(
      table.regionId,
      table.manufacturerId,
      table.stockDate,
    ),
    check("daily_openings_qty_non_negative", sql`${table.openingQty} >= 0`),
  ],
)

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    manufacturerId: uuid("manufacturer_id")
      .notNull()
      .references(() => manufacturers.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id),
    saleDate: date("sale_date", { mode: "string" }).notNull(),
    quantity: integer("quantity").notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sales_agent_manufacturer_date").on(table.agentId, table.manufacturerId, table.saleDate),
    check("sales_quantity_non_negative", sql`${table.quantity} >= 0`),
  ],
)

export const cashDays = pgTable(
  "cash_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    cashDate: date("cash_date", { mode: "string" }).notNull(),
    balanceBroughtForward: integer("balance_brought_forward").notNull(),
    cashReceived: integer("cash_received").notNull(),
    closingBalance: integer("closing_balance"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cash_days_region_date").on(table.regionId, table.cashDate),
    check("cash_days_brought_forward_non_negative", sql`${table.balanceBroughtForward} >= 0`),
    check("cash_days_received_non_negative", sql`${table.cashReceived} >= 0`),
    check(
      "cash_days_closing_non_negative",
      sql`${table.closingBalance} IS NULL OR ${table.closingBalance} >= 0`,
    ),
  ],
)

export const cashSends = pgTable(
  "cash_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => users.id),
    sendDate: date("send_date", { mode: "string" }).notNull(),
    amount: integer("amount").notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cash_sends_region_date").on(table.regionId, table.sendDate),
    check("cash_sends_amount_non_negative", sql`${table.amount} >= 0`),
  ],
)

export type AuditJson = Record<string, string | number | boolean | null>

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  before: jsonb("before").$type<AuditJson | null>(),
  after: jsonb("after").$type<AuditJson | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type UserRole = (typeof roleEnum.enumValues)[number]
export type DbUser = typeof users.$inferSelect
