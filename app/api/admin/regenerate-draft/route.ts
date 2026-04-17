import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Source = { title: string; url: string }

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
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { question, context } = await req.json()
  if (!question || !context) {
    return NextResponse.json({ error: 'question and context required' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Write a completely new answer from scratch to this player's question. Use the context below as your raw material — it may contain a previous draft, notes Elijah jotted in, or a mix of both. Weave it all together into one cohesive, polished answer. Do not append or reference anything. Just write a single complete answer as if you knew all of this from the start. Same voice, same directness as Elijah.

You have access to web_search and web_fetch. Use them when:
- Elijah's notes mention a book, study, article, or person by name and a specific quote or fact would make the answer stronger
- A URL is pasted in the notes (fetch it with web_fetch and pull the relevant passage)
- A fact, stat, or claim needs verification before you say it

Do NOT use the web for general advice Elijah could give from his own experience. Only for specific external references. Keep searches minimal — one or two is plenty.

Player's question:
"${question}"

Context and notes to work from:
${context}

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
  const sources = extractSources(res.content)

  return NextResponse.json({ draft: newDraft, sources })
}
