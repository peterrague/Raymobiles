import "server-only"
import { cookies } from "next/headers"

const COOKIE = "desk-region"

export async function rememberedRegion() {
  return (await cookies()).get(COOKIE)?.value ?? ""
}

export async function selectedRegion(
  requested: string,
  regions: { id: string }[],
  options?: { allowAll?: boolean },
) {
  if (requested && regions.some((region) => region.id === requested)) return requested
  const stored = await rememberedRegion()
  if (stored === "all") return options?.allowAll ? "" : (regions[0]?.id ?? "")
  if (stored && regions.some((region) => region.id === stored)) return stored
  return regions[0]?.id ?? ""
}
