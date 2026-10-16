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
    active: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("manufacturers_name_lower").on(sql`lower(${table.name})`)],
)

export const supplierPhones = pgTable(
  "supplier_phones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => manufacturers.id),
    phoneType: text("phone_type").notNull(),
    model: text("model").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("supplier_phones_supplier_model").on(table.supplierId, sql`lower(${table.model})`),
    check("supplier_phones_quantity_non_negative", sql`${table.quantity} >= 0`),
  ],
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
    active: boolean("is_active").notNull().default(true),
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
  "stock_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manufacturerId: uuid("manufacturer_id")
      .notNull()
      .references(() => manufacturers.id),
    quantity: integer("quantity").notNull(),
    receivedOn: date("received_on", { mode: "string" }).notNull(),
    notes: text("notes"),
    reference: text("reference").notNull(),
    recordedBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("central_receipts_quantity_non_negative", sql`${table.quantity} >= 0`)],
)

export const allocations = pgTable(
  "stock_allocations",
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
    recordedBy: uuid("created_by")
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
    phoneId: uuid("phone_id").references(() => supplierPhones.id),
    priceDate: date("business_date", { mode: "string" }).notNull(),
    unitPrice: integer("price_minor").notNull(),
    recordedBy: uuid("set_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("daily_prices_region_phone_date").on(table.regionId, table.phoneId, table.priceDate),
    check("daily_prices_unit_price_non_negative", sql`${table.unitPrice} >= 0`),
  ],
)

export const dailyOpenings = pgTable(
  "daily_stock",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    manufacturerId: uuid("manufacturer_id")
      .notNull()
      .references(() => manufacturers.id),
    stockDate: date("business_date", { mode: "string" }).notNull(),
    openingQty: integer("opening_qty").notNull(),
    recordedBy: uuid("set_by")
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
    phoneId: uuid("phone_id").references(() => supplierPhones.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id),
    saleDate: date("business_date", { mode: "string" }).notNull(),
    quantity: integer("quantity").notNull(),
    recordedBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sales_agent_phone_date").on(table.agentId, table.phoneId, table.saleDate),
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
    cashDate: date("business_date", { mode: "string" }).notNull(),
    balanceBroughtForward: integer("opening_balance_manual_minor").notNull(),
    cashReceived: integer("cash_received_minor").notNull(),
    closingBalance: integer("closing_balance_minor"),
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
  "cash_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => users.id),
    sendDate: date("business_date", { mode: "string" }).notNull(),
    amount: integer("amount_minor").notNull(),
    reference: text("reference").notNull(),
    recordedBy: uuid("created_by")
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
  actorRole: roleEnum("actor_role").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  before: jsonb("before").$type<AuditJson | null>(),
  after: jsonb("after").$type<AuditJson | null>(),
  requestId: text("request_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type UserRole = (typeof roleEnum.enumValues)[number]
export type DbUser = typeof users.$inferSelect
