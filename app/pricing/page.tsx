import { PricingPageContent } from './pricing-content'
import { getPricingPhase } from '@/lib/pricing-phase'

export const revalidate = 60

export default async function PricingPage() {
  return <PricingPageContent phase={getPricingPhase()} />
}
