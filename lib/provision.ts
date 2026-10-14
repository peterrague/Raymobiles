import "server-only"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { auditEntry } from "./audit"
import { getDb } from "./db"
import { auditLogs, users } from "./db/schema"

export function adminEmails() {
  return (process.env.ADMIN_EMAIL ?? "")
    .split(/[\s,]+/)
    .map((part) => part.trim().replace(/^["']+|["']+$/g, "").toLowerCase())
    .filter((part) => part.includes("@"))
}

export async function allowGoogleSignIn(input: {
  email: string
  name?: string | null
  image?: string | null
}) {
  const email = input.email.toLowerCase().trim()
  const db = getDb()
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (existing) {
    if (!existing.active) return false
    if (input.image && input.image !== existing.image) {
      await db
        .update(users)
        .set({ image: input.image, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
    }
    return true
  }

  if (!adminEmails().includes(email)) return false

  const id = randomUUID()
  const name = input.name?.trim() || email
  await db.batch([
    db.insert(users).values({
      id,
      email,
      name,
      image: input.image ?? null,
      role: "ADMIN",
      active: true,
    }),
    db.insert(auditLogs).values(
      auditEntry({
        actorId: id,
        actorRole: "ADMIN",
        action: "create",
        entityType: "user",
        entityId: id,
        after: { email, name, role: "ADMIN", region: null, lead: null, active: true },
      }),
    ),
  ])
  return true
}
