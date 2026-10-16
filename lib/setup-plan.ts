export function leastRegionIds(regions: { id: string; remaining: number }[]) {
  if (regions.length === 0) return []
  const least = Math.min(...regions.map((region) => region.remaining))
  return regions.filter((region) => region.remaining === least).map((region) => region.id)
}

export function splitAcross(quantity: number, regionIds: string[]) {
  if (quantity < 1 || regionIds.length === 0) return []
  const base = Math.floor(quantity / regionIds.length)
  let extra = quantity % regionIds.length
  return regionIds
    .map((regionId) => {
      const share = base + (extra > 0 ? 1 : 0)
      if (extra > 0) extra -= 1
      return { regionId, quantity: share }
    })
    .filter((row) => row.quantity > 0)
}
