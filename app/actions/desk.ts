"use server"

import { cookies } from "next/headers"

const COOKIE = "desk-region"

export async function rememberDeskRegion(regionId: string) {
  const jar = await cookies()
  const value = regionId || "all"
  jar.set(COOKIE, value, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 90,
  })
}
