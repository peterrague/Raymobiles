import type { Metadata } from "next"
import { Figtree, Fraunces, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"

export const instant = false

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
})

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
})

export const metadata: Metadata = {
  title: {
    default: "Raymobiles",
    template: "%s · Raymobiles",
  },
  description: "Stock, sales, and deposit cash for phone distribution across regions.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${fraunces.variable} ${plex.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
