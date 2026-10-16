"use client"

import { useState } from "react"
import { inputClass, labelClass } from "./ui"

export function PhoneChoice({
  phones,
  suppliers,
  typeLabel = "Type of phone",
}: {
  phones: { id: string; supplierId?: string; phoneType: string; model: string }[]
  suppliers?: { id: string; name: string }[]
  typeLabel?: string
}) {
  const [supplierId, setSupplierId] = useState(suppliers?.[0]?.id ?? "")
  const scoped = suppliers ? phones.filter((phone) => phone.supplierId === supplierId) : phones
  const types = [...new Set(scoped.map((phone) => phone.phoneType))]
  const [type, setType] = useState(types[0] ?? "")
  const activeType = types.includes(type) ? type : (types[0] ?? "")
  const models = scoped.filter((phone) => phone.phoneType === activeType)
  const [phoneId, setPhoneId] = useState(models[0]?.id ?? "")
  const selected = models.some((phone) => phone.id === phoneId) ? phoneId : (models[0]?.id ?? "")

  return (
    <>
      {suppliers ? (
        <label className={labelClass}>
          Supplier
          <select
            name="manufacturerId"
            value={supplierId}
            className={inputClass}
            required
            onChange={(event) => {
              const nextSupplier = event.target.value
              setSupplierId(nextSupplier)
              const nextPhone = phones.find((phone) => phone.supplierId === nextSupplier)
              setType(nextPhone?.phoneType ?? "")
              setPhoneId(nextPhone?.id ?? "")
            }}
          >
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {scoped.length === 0 ? (
        <p className="text-sm text-ink/60">This supplier has no phone models yet. Add them on the Team page.</p>
      ) : (
        <>
          <label className={labelClass}>
            {typeLabel}
            <select
              value={activeType}
              className={inputClass}
              required
              onChange={(event) => {
                const nextType = event.target.value
                setType(nextType)
                const next = scoped.find((phone) => phone.phoneType === nextType)
                setPhoneId(next?.id ?? "")
              }}
            >
              {types.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Model
            <select
              name="phoneId"
              value={selected}
              className={inputClass}
              required
              onChange={(event) => setPhoneId(event.target.value)}
            >
              {models.map((phone) => (
                <option key={phone.id} value={phone.id}>
                  {phone.model}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </>
  )
}
