import "server-only"
import { cookies } from "next/headers"
import { PREVIEW_COOKIE, previewRoleFromCookie } from "./preview-cookie"

export async function previewRole() {
  const jar = await cookies()
  return previewRoleFromCookie(jar.get(PREVIEW_COOKIE)?.value)
}

export async function isPreview() {
  return (await previewRole()) !== null
}
