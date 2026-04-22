import type { MetadataRoute } from 'next'
import { getSupabase } from '@/lib/supabase-server'

/**
 * Sitemap for elijahbryant.pro.
 *
 * Includes the static landing surfaces plus every approved /browse/[id]
 * page so Google can index Elijah's answers individually. Each approved
 * answer already renders with QAPage JSON-LD (see app/browse/[id]/page.tsx),
 * so discovery + rich-snippet eligibility come for free once the URLs are
 * in the sitemap.
 *
 * This is the silent compounding SEO engine — it runs in the background
 * and every new approved answer becomes a long-tail-searchable URL.
 */

const BASE_URL = 'https://elijahbryant.pro'

// Next.js serves this as /sitemap.xml. Keep it reasonably fresh.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/browse`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  ]

  try {
    const supabase = getSupabase()
    // Cap at 5000 to stay well under the 50k sitemap limit. Per-answer pages
    // are lightweight, and if the archive ever grows past that we'll split
    // into a sitemap index.
    const { data } = await supabase
      .from('questions')
      .select('id, created_at, approved_at')
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('approved_at', { ascending: false })
      .limit(5000)

    const browseEntries: MetadataRoute.Sitemap = (data || []).map((q) => ({
      url: `${BASE_URL}/browse/${q.id}`,
      lastModified: new Date(q.approved_at || q.created_at),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))

    return [...statics, ...browseEntries]
  } catch {
    // If Supabase is unreachable at request time, at least return the
    // static landing URLs. Google will re-crawl the sitemap and pick up
    // the rest next time.
    return statics
  }
}
