import type { ReactNode } from "react"

export const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-pine px-3 py-2 text-sm font-semibold text-white transition hover:bg-pine-soft disabled:cursor-wait disabled:opacity-60"
export const quietButtonClass =
  "inline-flex items-center justify-center rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
export const inputClass =
  "w-full min-w-36 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
export const labelClass = "grid gap-1 text-sm font-medium"

export function PageHeader({ title, lede }: { title: string; lede?: string }) {
  return (
    <header className="mb-6 max-w-3xl">
      <h1 className="font-serif text-3xl tracking-tight text-ink">{title}</h1>
      {lede ? <p className="mt-2 text-sm leading-6 text-ink/70">{lede}</p> : null}
    </header>
  )
}

export function Panel({
  title,
  children,
  aside,
}: {
  title: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
      <p className="num mt-1 text-xl">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-ink/60">{hint}</p> : null}
    </div>
  )
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  const toneClass = tone === "warn" ? "bg-clay-soft text-clay" : "bg-gold-soft text-ink"
  return <p className={`rounded-md px-3 py-2 text-sm leading-6 ${toneClass}`}>{children}</p>
}

export function DataTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

export function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`border-b border-line px-2 py-2 text-xs font-semibold uppercase tracking-wide text-ink/50 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  )
}

export function Td({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <td className={`border-b border-line/80 px-2 py-2 ${align === "right" ? "num text-right" : ""}`}>
      {children}
    </td>
  )
}
