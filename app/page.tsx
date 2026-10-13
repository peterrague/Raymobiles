import { signInToPreview } from "@/app/actions/auth"

export const instant = false

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center overflow-hidden bg-paper px-6 py-16">
      <div className="pointer-events-none absolute -top-48 -right-40 h-[36rem] w-[36rem] rounded-full bg-pine" />
      <div className="pointer-events-none absolute top-24 -right-16 h-40 w-40 rounded-full bg-gold/30" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-gold-soft" />

      <div className="relative mx-auto w-full max-w-xl">
        <p className="text-xs font-semibold tracking-[0.28em] text-gold">PHONE DISTRIBUTION</p>
        <h1 className="mt-5 font-serif text-6xl leading-[0.92] tracking-tight text-ink sm:text-8xl">Batrobas</h1>
        <div className="mt-6 h-px w-16 bg-gold" />
        <p className="mt-6 max-w-sm text-lg leading-8 text-ink/70">
          Stock, sales, and the cash for the day’s phones.
        </p>
        <form action={signInToPreview} className="mt-10">
          <button className="rounded-full bg-pine px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-pine-soft">
            Sign in
          </button>
        </form>
      </div>
    </main>
  )
}
