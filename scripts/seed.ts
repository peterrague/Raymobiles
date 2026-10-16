import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"
import { eq, sql } from "drizzle-orm"
import { getDb } from "../lib/db"
import { manufacturers, regions } from "../lib/db/schema"

config({ path: ".env.local" })
config({ path: ".env" })

const regionNames = ["Mombasa", "Nyandarua"]

async function main() {
  // drizzle-kit push asks about older table renames in this database, so the new
  // supplier phone table is created here when it is missing.
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  const client = neon(url)
  await client`
    CREATE TABLE IF NOT EXISTS supplier_phones (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      supplier_id uuid NOT NULL REFERENCES manufacturers(id),
      phone_type text NOT NULL,
      model text NOT NULL,
      quantity integer NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT supplier_phones_quantity_non_negative CHECK (quantity >= 0)
    )
  `
  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS supplier_phones_supplier_model
    ON supplier_phones (supplier_id, lower(model))
  `
  await client`ALTER TABLE daily_prices ADD COLUMN IF NOT EXISTS phone_id uuid REFERENCES supplier_phones(id)`
  await client`ALTER TABLE sales ADD COLUMN IF NOT EXISTS phone_id uuid REFERENCES supplier_phones(id)`
  await client`DROP INDEX IF EXISTS daily_prices_region_manufacturer_date`
  await client`DROP INDEX IF EXISTS sales_agent_manufacturer_date`
  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS daily_prices_region_phone_date
    ON daily_prices (region_id, phone_id, business_date)
  `
  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS sales_agent_phone_date
    ON sales (agent_id, phone_id, business_date)
  `
  const db = getDb()
  const suppliers = await db.select().from(manufacturers)
  const jill =
    suppliers.find((supplier) => supplier.name.toLowerCase() === "jill") ??
    suppliers.find((supplier) => supplier.name.toLowerCase() === "jill multichoice")

  if (!jill) {
    await db.insert(manufacturers).values({ name: "Jill", active: true })
  } else if (jill.name !== "Jill" || !jill.active) {
    await db.update(manufacturers).set({ name: "Jill", active: true }).where(eq(manufacturers.id, jill.id))
  }

  for (const supplier of suppliers) {
    if (jill && supplier.id === jill.id) continue
    if (supplier.active) {
      await db.update(manufacturers).set({ active: false }).where(eq(manufacturers.id, supplier.id))
    }
  }

  for (const name of regionNames) {
    const [existing] = await db
      .select()
      .from(regions)
      .where(sql`lower(${regions.name}) = ${name.toLowerCase()}`)
      .limit(1)
    if (!existing) await db.insert(regions).values({ name })
  }
  console.log("Seeded Jill and the two regions. Other suppliers are inactive.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
