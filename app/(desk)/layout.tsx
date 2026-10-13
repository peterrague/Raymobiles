import { Suspense } from "react"
import { Shell } from "@/components/shell"
import { findRegion } from "@/lib/data"
import { requireUser } from "@/lib/session"

export const instant = false

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DeskFallback />}>
      <DeskFrame>{children}</DeskFrame>
    </Suspense>
  )
}

async function DeskFrame({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const region = user.regionId ? await findRegion(user.regionId) : null
  return (
    <Shell user={user} regionName={region?.name ?? null}>
      {children}
    </Shell>
  )
}

function DeskFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper text-sm text-ink/60">Opening the desk…</div>
  )
}
