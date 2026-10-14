import { randomUUID } from "node:crypto"
import type { AuditJson, UserRole } from "./db/schema"

export function sameJson(before: AuditJson, after: AuditJson) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    if ((before[key] ?? null) !== (after[key] ?? null)) return false
  }
  return true
}

export function auditEntry(entry: {
  actorId: string
  actorRole: UserRole
  action: string
  entityType: string
  entityId: string
  before?: AuditJson | null
  after?: AuditJson | null
}) {
  return {
    id: randomUUID(),
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    requestId: randomUUID(),
  }
}
