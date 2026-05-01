import { PricingPageContent } from '../pricing/pricing-content'

export const revalidate = 60

export default async function PricingPreviewPage() {
  return <PricingPageContent phase="public" isPreview />
}

