"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveDailyDraft, submitDailySetup, type DailySetupInput } from "@/app/actions/daily-setup"
import { formatKes, formatNumber } from "@/lib/format"
import { leastRegionIds } from "@/lib/setup-plan"
import { inputClass, labelClass } from "./ui"

const STEPS = ["Stock", "Supplier", "Cash", "Review"] as const
const SUPPLIER_STEPS = ["Supplier", "Phone", "Where it goes"] as const

export function DailySetupWizard({
  date,
  submitted,
  regions,
  suppliers,
  phones,
  initial,
}: {
  date: string
  submitted: boolean
  regions: { id: string; name: string; remaining: number; leadName: string | null; cash: string }[]
  suppliers: { id: string; name: string; active: boolean }[]
  phones: { id: string; supplierId: string; phoneType: string; model: string }[]
  initial: { supplierId: string; phoneId: string; quantity: string; sends: Record<string, string> }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [part, setPart] = useState(0)
  const [supplierId, setSupplierId] = useState(initial.supplierId)
  const [phoneId, setPhoneId] = useState(initial.phoneId)
  const [quantity, setQuantity] = useState(initial.quantity)
  const [sends, setSends] = useState<Record<string, string>>(
    Object.fromEntries(regions.map((region) => [region.id, initial.sends[region.id] ?? ""])),
  )
  const [cash, setCash] = useState<Record<string, string>>(Object.fromEntries(regions.map((region) => [region.id, region.cash])))
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const supplierPhones = phones.filter((phone) => phone.supplierId === supplierId)
  const types = [...new Set(supplierPhones.map((phone) => phone.phoneType))]
  const selectedPhone = supplierPhones.find((phone) => phone.id === phoneId) ?? null
  const activeType = selectedPhone?.phoneType ?? types[0] ?? ""
  const models = supplierPhones.filter((phone) => phone.phoneType === activeType)
  const leastIds = leastRegionIds(regions)
  const sentTotal = regions.reduce((sum, region) => sum + (Number(sends[region.id]) || 0), 0)
  const received = Number(quantity) || 0

  function chooseSupplier(id: string) {
    setSupplierId(id)
    const next = phones.find((phone) => phone.supplierId === id)
    setPhoneId(next?.id ?? "")
  }

  function payload(): DailySetupInput {
    return {
      date,
      supplierId,
      phoneId,
      quantity,
      sends: regions.map((region) => ({ regionId: region.id, quantity: sends[region.id] ?? "" })),
      cash: regions.map((region) => ({ regionId: region.id, amount: cash[region.id] ?? "" })),
    }
  }

  function run(action: typeof saveDailyDraft, done: string) {
    setError("")
    setMessage("")
    startTransition(async () => {
      const result = await action({}, payload())
      if (result.error) {
        setError(result.error)
        return
      }
      setMessage(done)
      router.refresh()
    })
  }

  function next() {
    setError("")
    setMessage("")
    if (step === 1 && part < SUPPLIER_STEPS.length - 1) {
      setPart(part + 1)
      return
    }
    setPart(0)
    setStep(Math.min(step + 1, STEPS.length - 1))
  }

  function back() {
    setError("")
    setMessage("")
    if (step === 1 && part > 0) {
      setPart(part - 1)
      return
    }
    setStep(Math.max(step - 1, 0))
    setPart(step === 2 ? SUPPLIER_STEPS.length - 1 : 0)
  }

  const supplierReady = Boolean(supplierId)
  const phoneReady = Boolean(phoneId) && received >= 1
  const sendsReady =
    regions.every((region) => {
      const value = (sends[region.id] ?? "").trim()
      return value === "" || /^\d+$/.test(value)
    }) && sentTotal <= received
  const nextDisabled =
    (step === 1 && part === 0 && !supplierReady) ||
    (step === 1 && part === 1 && !phoneReady) ||
    (step === 1 && part === 2 && !sendsReady)

  return (
    <div>
      {submitted ? (
        <p className="mb-4 rounded-md bg-moss/10 px-3 py-2 text-sm text-moss">
          This date was already submitted. Submitting again updates it.
        </p>
      ) : null}
      <ol className="mb-4 flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => {
                if (index < step) {
                  setStep(index)
                  setPart(0)
                }
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                index === step ? "bg-pine text-white" : "bg-mist text-ink/70"
              }`}
            >
              {index + 1} {label}
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm text-ink/70">{intro(step)}</p>

      <section className="rounded-xl border border-line bg-panel p-4">
        {step === 1 ? (
          <ol className="mb-4 flex flex-wrap gap-2">
            {SUPPLIER_STEPS.map((label, index) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => {
                    if (index < part) setPart(index)
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    index === part ? "bg-pine text-white" : "bg-mist text-ink/70"
                  }`}
                >
                  {index + 1} {label}
                </button>
              </li>
            ))}
          </ol>
        ) : null}

        {step === 0 ? <StockStep regions={regions} leastIds={leastIds} /> : null}
        {step === 1 && part === 0 ? (
          <SupplierStep suppliers={suppliers} supplierId={supplierId} onChoose={chooseSupplier} />
        ) : null}
        {step === 1 && part === 1 ? (
          <div className="grid gap-3">
            {supplierPhones.length === 0 ? (
              <p className="text-sm text-ink/60">This supplier has no phone models yet. Add them on Team.</p>
            ) : (
              <>
                <label className={labelClass}>
                  Type of phone supplied
                  <select
                    className={inputClass}
                    value={activeType}
                    onChange={(event) => {
                      const next = supplierPhones.find((phone) => phone.phoneType === event.target.value)
                      setPhoneId(next?.id ?? "")
                    }}
                  >
                    {types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Model
                  <select className={inputClass} value={phoneId} onChange={(event) => setPhoneId(event.target.value)}>
                    {models.map((phone) => (
                      <option key={phone.id} value={phone.id}>
                        {phone.model}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label className={labelClass}>
              Quantity
              <input
                inputMode="numeric"
                className={inputClass}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        {step === 1 && part === 2 ? (
          <WhereStep
            supplier={suppliers.find((item) => item.id === supplierId)?.name ?? "Supplier"}
            phone={selectedPhone}
            received={received}
            sentTotal={sentTotal}
            regions={regions.map((region) => ({
              id: region.id,
              name: region.name,
              remaining: region.remaining,
              least: leastIds.includes(region.id),
              quantity: sends[region.id] ?? "",
            }))}
            onChange={(regionId, value) => setSends({ ...sends, [regionId]: value })}
          />
        ) : null}
        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {regions.map((region) => (
              <label key={region.id} className={`${labelClass} rounded-lg border border-line bg-white p-3`}>
                Cash for {region.leadName ?? "no sales lead"}
                <span className="text-xs font-normal text-ink/55">{region.name}</span>
                <input
                  inputMode="numeric"
                  className={inputClass}
                  value={cash[region.id] ?? ""}
                  onChange={(event) => setCash({ ...cash, [region.id]: event.target.value })}
                  placeholder="Amount in shillings"
                />
              </label>
            ))}
          </div>
        ) : null}
        {step === 3 ? (
          <Review
            supplier={suppliers.find((item) => item.id === supplierId)?.name ?? null}
            phone={selectedPhone}
            quantity={quantity}
            shares={regions
              .filter((region) => Number(sends[region.id]) > 0)
              .map((region) => ({
                name: region.name,
                quantity: Number(sends[region.id]),
              }))}
            cash={regions.map((region) => ({
              name: region.name,
              lead: region.leadName,
              amount: cash[region.id] ?? "",
            }))}
          />
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-clay" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="mt-3 text-sm text-moss">{message}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={quietPill} onClick={back} disabled={pending || (step === 0 && part === 0)}>
            Back
          </button>
          <button type="button" className={draftPill} disabled={pending} onClick={() => run(saveDailyDraft, "Draft saved.")}>
            {pending ? "Saving…" : "Save draft"}
          </button>
          {step === 1 && part === 0 ? (
            <button
              type="button"
              className={draftPill}
              onClick={() => {
                setSupplierId("")
                setPhoneId("")
                setQuantity("")
                setSends(Object.fromEntries(regions.map((region) => [region.id, ""])))
                setPart(0)
                setStep(2)
              }}
            >
              Skip
            </button>
          ) : null}
          {step < 3 ? (
            <button type="button" className={nextDisabled ? disabledPill : nextPill} disabled={pending || nextDisabled} onClick={next}>
              Next
            </button>
          ) : (
            <button type="button" className={nextPill} disabled={pending} onClick={() => run(submitDailySetup, "Submitted.")}>
              {pending ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

function StockStep({
  regions,
  leastIds,
}: {
  regions: { id: string; name: string; remaining: number }[]
  leastIds: string[]
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {regions.map((region) => {
        const least = leastIds.includes(region.id)
        return (
          <div key={region.id} className={`rounded-lg border px-4 py-3 ${least ? "border-pine bg-white" : "border-line bg-white"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{region.name}</p>
            <p className="num mt-1 text-xl">{formatNumber(region.remaining)}</p>
            <p className="mt-1 text-xs text-ink/60">{least ? "Least remaining phones" : "Remaining phones"}</p>
          </div>
        )
      })}
    </div>
  )
}

function SupplierStep({
  suppliers,
  supplierId,
  onChoose,
}: {
  suppliers: { id: string; name: string; active: boolean }[]
  supplierId: string
  onChoose: (id: string) => void
}) {
  const catalogue = suppliers.filter((supplier) => supplier.active)
  return (
    <div>
      <label className={labelClass}>
        Supplier
        <select className={inputClass} value={supplierId} onChange={(event) => onChoose(event.target.value)} required>
          <option value="">Choose a supplier</option>
          {catalogue.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      </label>
      <h3 className="mt-5 mb-1 text-sm font-semibold">Suppliers already in the catalogue</h3>
      <ul className="divide-y divide-line">
        {catalogue.map((supplier) => {
          const chosen = supplier.id === supplierId
          return (
            <li key={supplier.id}>
              <button
                type="button"
                onClick={() => onChoose(supplier.id)}
                className={`flex w-full items-center justify-between gap-3 py-3 text-left text-sm ${chosen ? "font-semibold text-pine" : ""}`}
              >
                <span>{supplier.name}</span>
                <span>{chosen ? "Chosen" : "Select"}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function WhereStep({
  supplier,
  phone,
  received,
  sentTotal,
  regions,
  onChange,
}: {
  supplier: string
  phone: { phoneType: string; model: string } | null
  received: number
  sentTotal: number
  regions: { id: string; name: string; remaining: number; least: boolean; quantity: string }[]
  onChange: (regionId: string, value: string) => void
}) {
  const over = sentTotal > received
  return (
    <div>
      <p className="text-sm leading-6">
        {phone
          ? `${formatNumber(received)} ${phone.phoneType} · ${phone.model} received from ${supplier}. Type how many each region gets.`
          : "Choose a phone before sending any to a region."}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {regions.map((region) => (
          <label key={region.id} className={`${labelClass} rounded-lg border border-line bg-white p-3`}>
            {region.name}
            <span className="text-xs font-normal text-ink/55">
              {formatNumber(region.remaining)} remaining{region.least ? " · least left" : ""}
            </span>
            <input
              inputMode="numeric"
              className={inputClass}
              value={region.quantity}
              placeholder="Phones to send"
              onChange={(event) => onChange(region.id, event.target.value)}
            />
          </label>
        ))}
      </div>
      <p className={`mt-3 text-sm ${over ? "text-clay" : "text-ink/70"}`}>
        {formatNumber(sentTotal)} of {formatNumber(received)} phones assigned
        {over ? ". That is more than were received." : "."}
      </p>
    </div>
  )
}

function Review({
  supplier,
  phone,
  quantity,
  shares,
  cash,
}: {
  supplier: string | null
  phone: { phoneType: string; model: string } | null
  quantity: string
  shares: { name: string; quantity: number }[]
  cash: { name: string; lead: string | null; amount: string }[]
}) {
  return (
    <div className="grid gap-4 text-sm">
      <div>
        <h3 className="font-semibold">Stock received</h3>
        {supplier && phone && quantity ? (
          <p className="mt-1 text-ink/80">
            {supplier} · {phone.phoneType} · {phone.model} · {formatNumber(Number(quantity))} phones
            {shares.length > 0
              ? `. ${shares.map((share) => `${share.name} ${formatNumber(share.quantity)}`).join(", ")}.`
              : ". None sent to a region yet."}
          </p>
        ) : (
          <p className="mt-1 text-ink/60">No phones on this setup.</p>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Cash to sales leads</h3>
        <ul className="mt-1 divide-y divide-line">
          {cash.map((row) => (
            <li key={row.name} className="flex justify-between py-2">
              <span>
                {row.name}
                {row.lead ? ` · ${row.lead}` : ""}
              </span>
              <span className="num">{row.amount ? formatKes(Number(row.amount)) : "—"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function intro(step: number) {
  if (step === 0) return "Remaining phones in each region. New phones go to whichever region has the least left."
  if (step === 1) return "Choose the supplier, then the phone type, model, and quantity. Samsung, Tecno, Infinix, and Oppo are phones. Stock waits until you submit."
  if (step === 2) return "Cash for the sales lead in each region. It is sent when you submit."
  return "Check the stock and the cash, then submit. Submitting again updates this date."
}

const quietPill = "rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
const draftPill = "rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
const nextPill = "rounded-full bg-pine px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
const disabledPill = "rounded-full bg-mist px-4 py-2 text-sm font-semibold text-ink/35"
