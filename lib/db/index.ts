import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

let database: NeonHttpDatabase<typeof schema> | undefined

export function getDb() {
  if (!database) {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error("DATABASE_URL is not set")
    }
    database = drizzle(neon(url), { schema })
  }
  return database
}

export type Database = ReturnType<typeof getDb>
