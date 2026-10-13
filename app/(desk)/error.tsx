"use client"

export default function DeskError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-lg rounded-xl border border-line bg-panel p-5">
      <h1 className="font-serif text-2xl">The desk could not load</h1>
      <p className="mt-2 text-sm leading-6 text-ink/70">
        Check that Neon is reachable and the schema has been pushed, then try again.
      </p>
      <button
        className="mt-4 rounded-md bg-pine px-3 py-2 text-sm font-semibold text-white"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  )
}
