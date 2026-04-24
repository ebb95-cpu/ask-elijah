import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Source = { title: string; url: string }
type PineconeMatch = {
  score: number
  metadata?: Record<string, string>
}

async function embedText(text: string): Promise<number[] | null> {
  if (!process.env.VOYAGE_API_KEY) return null
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.data?.[0]?.embedding || null
}

async function searchKnowledgeBase(query: string): Promise<{ context: string; sources: Source[] }> {
  if (!process.env.PINECONE_HOST || !process.env.PINECONE_API_KEY) {
    return { context: '', sources: [] }
  }

  try {
    const embedding = await embedText(query)
    if (!embedding) return { context: '', sources: [] }

    const res = await fetch(`${process.env.PINECONE_HOST}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vector: embedding, topK: 6, includeMetadata: true }),
    })
    if (!res.ok) return { context: '', sources: [] }

    const data = await res.json()
    const matches = ((data.matches || []) as PineconeMatch[])
      .filter((m) => m.score >= 0.35 && m.metadata?.text)

    const context = matches
      .map((m, i) => {
        const title = m.metadata?.source_title || m.metadata?.title || 'Elijah knowledge base'
        return `[KB ${i + 1}: ${title}, score ${m.score.toFixed(2)}]\n${m.metadata?.text}`
      })
      .join('\n\n---\n\n')

    const seen = new Set<string>()
    const sources = matches.flatMap((m) => {
      const url = m.metadata?.source_url || m.metadata?.video_url || ''
      if (!url || seen.has(url)) return []
      seen.add(url)
      return [{
        title: m.metadata?.source_title || m.metadata?.title || 'Elijah knowledge base',
        url,
      }]
    })

    return { context, sources }
  } catch {
    return { context: '', sources: [] }
  }
}

/**
 * Walk the Anthropic response content blocks and pull out every URL the model
 * consulted via web_search or web_fetch so the admin can verify quotes/links
 * before approving the answer.
 */
function extractSources(content: Anthropic.Messages.ContentBlock[]): Source[] {
  const seen = new Map<string, Source>()
  for (const block of content) {
    // web_search result blocks have the shape { type: 'web_search_tool_result',
    // content: [{ type: 'web_search_result', url, title }, ...] }
    if (block.type === 'web_search_tool_result') {
      const items = (block as unknown as { content: Array<{ url?: string; title?: string }> }).content || []
      for (const item of items) {
        if (item.url && !seen.has(item.url)) {
          seen.set(item.url, { url: item.url, title: item.title || item.url })
        }
      }
    }
    // web_fetch result blocks: { type: 'web_fetch_tool_result', content: {...} }
    if (block.type === 'web_fetch_tool_result') {
      const fetched = (block as unknown as { content?: { url?: string; title?: string } }).content
      if (fetched?.url && !seen.has(fetched.url)) {
        seen.set(fetched.url, { url: fetched.url, title: fetched.title || fetched.url })
      }
    }
    // Also pick up any citations attached to text blocks.
    if (block.type === 'text') {
      const citations = (block as unknown as { citations?: Array<{ url?: string; title?: string }> }).citations
      if (Array.isArray(citations)) {
        for (const c of citations) {
          if (c.url && !seen.has(c.url)) {
            seen.set(c.url, { url: c.url, title: c.title || c.url })
          }
        }
      }
    }
  }
  return Array.from(seen.values())
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const { question, context, remixInstruction } = await req.json()
  if (!question || !context) {
    return NextResponse.json({ error: 'question and context required' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const kb = await searchKnowledgeBase(`${question}\n\n${context}`.slice(0, 4000))

  const prompt = `Write a completely new answer from scratch to this player's question.

Priority order:
1. Elijah's current notes/draft below are the source of truth. Preserve his point of view, meaning, examples, and coaching angle.
2. Elijah's knowledge-base context can support, clarify, or sharpen the answer only when it clearly connects to what Elijah said.
3. Web research is only for fact-checking, neuroscience/psychology/sports-psychology grounding, and avoiding inaccurate mechanism claims.

If knowledge-base context does not intertwine with Elijah's current notes, leave it out. Do not force it in. Do not replace Elijah's opinion with generic sports psychology. If web research contradicts a mechanism claim, rewrite the mechanism so it is accurate while keeping Elijah's core point.

Use the context below as raw material — it may contain a previous draft, notes Elijah jotted in, or a mix of both. Weave it into one cohesive, polished answer. Do not append or reference anything. Just write a single complete answer as if you knew all of this from the start. Same voice, same directness as Elijah.

Requested remix direction:
${remixInstruction || 'General remix: make the answer cleaner, more cohesive, and easier for a young hooper to use.'}

Treat the remix direction as an editing instruction, not as part of the answer. If it asks for shorter, the new answer must be meaningfully shorter than Elijah's current notes/draft and should target 140-180 words unless that would remove the core point. If it asks for more practical, add concrete steps without bloating. If it asks for more Elijah, make the voice more direct and lived-in without adding fake personal stories.

You have web_search and web_fetch. USE THEM proactively. Before stating any mechanism claim (how the brain works under pressure, sleep, nervous-system regulation, HRV, visualization, confidence, recovery — any physiological or psychological "why this works"), verify it with a lookup. Two to four searches is the norm, not the exception.

Ground the answer in real neuroscience, psychology, sports psychology, physiology, or performance research when a mechanism is being explained. But the voice always wins. Never say "studies show" or use footnote-style citations inside the answer. Phrase research in first-person Elijah voice: "the reason this works is your nervous system..." or "I read something from a Stanford lab that said...". The science makes the mechanism credible; Elijah's voice keeps it human. Weave, don't stack.

Also use web_fetch when a URL is pasted in the notes, and verify any specific name, quote, or stat before putting it in Elijah's mouth.

Player's question:
"${question}"

Elijah's current notes/draft to prioritize:
${context}

Relevant Elijah knowledge-base context. Use only if it fits Elijah's notes:
${kb.context || '(No relevant knowledge-base context found.)'}

Write the full answer from scratch now:`

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: [
      { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
      { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 5 },
    ],
    messages: [{ role: 'user', content: prompt }],
  })

  // The final text block is the answer. Earlier blocks may be tool calls and
  // tool results that we harvest for sources.
  const textBlocks = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
  const newDraft = textBlocks.map((b) => b.text).join('\n\n').trim()
  const sources = Array.from(
    [...kb.sources, ...extractSources(res.content)]
      .reduce((seen, source) => {
        if (source.url && !seen.has(source.url)) seen.set(source.url, source)
        return seen
      }, new Map<string, Source>())
      .values()
  ).slice(0, 10)

  return NextResponse.json({ draft: newDraft, sources })
}
