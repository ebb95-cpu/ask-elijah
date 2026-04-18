/**
 * Google autocomplete pain-point scraper.
 *
 * Surprisingly powerful — Google's suggest endpoint reveals the literal
 * questions and phrasings real people are typing. Lightweight (one HTTP
 * call per seed, no auth) and resilient. We recurse one level by default:
 * seed → suggestions → suggestions-of-suggestions, deduped.
 *
 * Output is phrased as the raw typed queries rather than comment bodies,
 * so the synthesis prompt treats them as "top_questions" signal more
 * than pain narrative.
 */

import { RESEARCH_CONFIG } from './config'
import type { RawInsight } from './types'

async function suggest(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    if (!res.ok) return []
    const data = await res.json()
    // Response shape: [queryString, [suggestion1, suggestion2, ...]]
    if (!Array.isArray(data) || !Array.isArray(data[1])) return []
    return data[1] as string[]
  } catch {
    return []
  }
}

export async function collectAutocomplete(): Promise<RawInsight[]> {
  const { depth, perSeed } = RESEARCH_CONFIG.autocomplete
  const all = new Set<string>()

  for (const seed of RESEARCH_CONFIG.seedQueries) {
    const perSeedSet = new Set<string>()
    const queue: Array<{ q: string; level: number }> = [{ q: seed, level: 0 }]

    while (queue.length > 0 && perSeedSet.size < perSeed) {
      const { q, level } = queue.shift()!
      const suggestions = await suggest(q)
      for (const s of suggestions) {
        if (perSeedSet.size >= perSeed) break
        if (s === seed) continue
        if (perSeedSet.has(s)) continue
        perSeedSet.add(s)
        if (level + 1 < depth) queue.push({ q: s, level: level + 1 })
      }
    }

    perSeedSet.forEach((s) => all.add(s))
  }

  return Array.from(all).map((text) => ({
    source: 'autocomplete' as const,
    source_url: `https://www.google.com/search?q=${encodeURIComponent(text)}`,
    text,
    author: null,
    created_at: null,
  }))
}
