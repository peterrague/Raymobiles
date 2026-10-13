import { config } from "dotenv"
import { eq } from "drizzle-orm"
import { getDb } from "../lib/db"
import { manufacturers, regions } from "../lib/db/schema"

config({ path: ".env.local" })
config({ path: ".env" })

const manufacturerNames = ["Jill Multichoice", "Kwikhand Enterprise"]
const regionNames = ["Mombasa", "Nyandarua"]

async function main() {
  const db = getDb()
  for (const name of manufacturerNames) {
    const [existing] = await db.select().from(manufacturers).where(eq(manufacturers.name, name)).limit(1)
    if (!existing) await db.insert(manufacturers).values({ name, active: true })
  }
  for (const name of regionNames) {
    const [existing] = await db.select().from(regions).where(eq(regions.name, name)).limit(1)
    if (!existing) await db.insert(regions).values({ name })
  }
  console.log("Seeded manufacturers and regions.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
