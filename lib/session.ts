import "server-only"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { auth, signOut } from "@/auth"
import { previewUser } from "./demo"
import { getDb } from "./db"
import { users, type DbUser, type UserRole } from "./db/schema"
import { ActionError } from "./errors"
import { previewRole } from "./preview"

export async function requireUser() {
  const role = await previewRole()
  if (role) return previewUser(role)
  if (!process.env.AUTH_SECRET) redirect("/?error=Configuration")
  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) redirect("/?error=Session")

  const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1)
  if (!user?.active) {
    await signOut({ redirectTo: "/?error=AccessDenied" })
    redirect("/?error=AccessDenied")
  }
  return user
}

export function requireRole(user: DbUser, roles: UserRole[]) {
  if (!roles.includes(user.role)) redirect("/dashboard")
}

export function assertAdmin(user: DbUser) {
  if (user.role !== "ADMIN") throw new ActionError("Only an admin can do that.")
}

export function assertCashAccess(user: DbUser) {
  if (user.role === "SALES_AGENT") throw new ActionError("Sales agents do not handle cash.")
}

export function assertRegionAccess(user: DbUser, regionId: string) {
  if (user.role !== "ADMIN" && user.regionId !== regionId) {
    throw new ActionError("That region is outside your access.")
  }
}

export function seesCash(user: DbUser) {
  return user.role !== "SALES_AGENT"
}
