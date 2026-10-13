import "server-only"
import type { NeonHttpDatabase } from "drizzle-orm/neon-http"
import type * as schema from "./db/schema"
import { getDb } from "./db"

type Batch = Parameters<NeonHttpDatabase<typeof schema>["batch"]>[0]

export async function commit(statements: Batch[number][]) {
  if (statements.length === 0) return
  const db = getDb()
  if (statements.length === 1) {
    await statements[0]
    return
  }
  await db.batch(statements as unknown as Batch)
}

/* this is a comment */
