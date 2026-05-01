export type PricingPhase = 'beta' | 'public'

export function getPricingPhase(): PricingPhase {
  return process.env.PRICING_PHASE === 'public' ? 'public' : 'beta'
}

