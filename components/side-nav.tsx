"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function SideNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname()

  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm whitespace-nowrap transition ${
              active ? "bg-white/15 font-semibold text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </>
  )
}
