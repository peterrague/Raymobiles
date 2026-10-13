import type { ReactNode } from "react"
import { signOutNow, switchPreviewRole } from "@/app/actions/auth"
import type { DbUser, UserRole } from "@/lib/db/schema"
import { roleLabel } from "@/lib/format"
import { previewRole } from "@/lib/preview"
import { PREVIEW_ROLES } from "@/lib/preview-cookie"
import { quietButtonClass } from "./ui"
import { SideNav } from "./side-nav"

const ITEMS = [
  { href: "/dashboard", label: "Desk", roles: ["ADMIN", "SALES_LEAD", "SALES_AGENT"] },
  { href: "/stock", label: "Stock", roles: ["ADMIN", "SALES_LEAD", "SALES_AGENT"] },
  { href: "/sales", label: "Sales", roles: ["ADMIN", "SALES_LEAD", "SALES_AGENT"] },
  { href: "/prices", label: "Prices", roles: ["ADMIN", "SALES_LEAD"] },
  { href: "/cash", label: "Cash", roles: ["ADMIN", "SALES_LEAD"] },
  { href: "/reports", label: "Reports", roles: ["ADMIN", "SALES_LEAD", "SALES_AGENT"] },
  { href: "/team", label: "Team", roles: ["ADMIN"] },
  { href: "/audit", label: "Audit log", roles: ["ADMIN"] },
] as const

export async function Shell({
  user,
  regionName,
  children,
}: {
  user: DbUser
  regionName: string | null
  children: ReactNode
}) {
  const preview = await previewRole()
  const items = ITEMS.filter((item) => (item.roles as readonly string[]).includes(user.role))

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15.5rem_1fr]">
      <aside className="bg-pine text-white md:min-h-screen">
        <div className="px-4 pt-5 pb-3">
          <p className="font-serif text-2xl tracking-tight">Batrobas</p>
          <p className="text-xs tracking-wide text-white/60">Phone distribution</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col" aria-label="Main">
          <SideNav items={items.map((item) => ({ href: item.href, label: item.label }))} />
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-8">
          <p className="text-sm">
            <span className="font-semibold">{user.name}</span>
            <span className="text-ink/50">
              {" "}
              · {roleLabel(user.role)}
              {regionName ? ` · ${regionName}` : ""}
            </span>
            {preview ? (
              <span className="ml-2 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold">
                Sample
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {preview ? <RoleSwitch role={user.role} /> : null}
            <form action={signOutNow}>
              <button className={quietButtonClass}>Sign out</button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}

function RoleSwitch({ role }: { role: UserRole }) {
  return (
    <form action={switchPreviewRole} className="flex rounded-full border border-line bg-white p-0.5">
      <span className="sr-only">View the desk as</span>
      {PREVIEW_ROLES.map((option) => {
        const current = option === role
        return (
          <button
            key={option}
            type={current ? "button" : "submit"}
            name="role"
            value={option}
            aria-pressed={current}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              current ? "bg-pine text-white" : "text-ink/70 hover:bg-mist"
            }`}
          >
            {roleLabel(option)}
          </button>
        )
      })}
    </form>
  )
}
