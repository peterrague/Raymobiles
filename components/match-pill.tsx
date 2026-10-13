import { cashGap } from "@/lib/books"
import { formatKes } from "@/lib/format"

export function MatchPill({ sent, received }: { sent: number | null; received: number | null }) {
  if (sent === null || received === null) {
    return <span className="rounded-full bg-mist px-2 py-1 text-xs font-semibold text-ink/70">Waiting</span>
  }
  const gap = cashGap(sent, received)
  if (gap === 0) {
    return <span className="rounded-full bg-moss/15 px-2 py-1 text-xs font-semibold text-moss">Match</span>
  }
  const direction = gap > 0 ? "Received more" : "Received less"
  return (
    <span className="rounded-full bg-clay-soft px-2 py-1 text-xs font-semibold text-clay">
      {direction} {formatKes(Math.abs(gap))}
    </span>
  )
}
