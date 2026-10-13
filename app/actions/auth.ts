"use server"

import { cookies } from "next/headers"
import { redirect, unstable_rethrow } from "next/navigation"
import { auth, signIn, signOut } from "@/auth"
import { isPreview } from "@/lib/preview"
import { PREVIEW_COOKIE, previewCookieValue, previewRoleFromForm } from "@/lib/preview-cookie"

export async function signInWithGoogle() {
  if (!process.env.AUTH_SECRET || !process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    redirect("/?error=Configuration")
  }
  await signIn("google", { redirectTo: "/dashboard" })
}

export async function signInToPreview() {
  const jar = await cookies()
  jar.set(PREVIEW_COOKIE, previewCookieValue("ADMIN"), previewCookieOptions())
  redirect("/dashboard")
}

export async function switchPreviewRole(formData: FormData) {
  const role = previewRoleFromForm(String(formData.get("role") ?? ""))
  if (!role || !(await isPreview())) redirect("/")
  const jar = await cookies()
  jar.set(PREVIEW_COOKIE, previewCookieValue(role), previewCookieOptions())
  redirect("/dashboard")
}

function previewCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  }
}

export async function signOutNow() {
  const jar = await cookies()
  jar.delete(PREVIEW_COOKIE)
  if (process.env.AUTH_SECRET) {
    try {
      const session = await auth()
      if (session) await signOut({ redirectTo: "/" })
    } catch (error) {
      unstable_rethrow(error)
    }
  }
  redirect("/")
}
