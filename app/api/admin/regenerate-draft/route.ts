import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { requireAdmin } from '@/lib/admin-auth'
import { sanitizeAnswerText } from '@/lib/answer-sanitize'
import { logError } from '@/lib/log-error'
import { getFreshnessInstruction } from '@/lib/freshness'
import { getElijahPreferenceContext } from '@/lib/elijah-learning'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Source = { title: string; url: string; type?: string }
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
        type: m.metadata?.source_type || 'knowledge_base',
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
          seen.set(item.url, { url: item.url, title: item.title || item.url, type: 'web' })
        }
      }
    }
    // web_fetch result blocks: { type: 'web_fetch_tool_result', content: {...} }
    if (block.type === 'web_fetch_tool_result') {
      const fetched = (block as unknown as { content?: { url?: string; title?: string } }).content
      if (fetched?.url && !seen.has(fetched.url)) {
        seen.set(fetched.url, { url: fetched.url, title: fetched.title || fetched.url, type: 'web' })
      }
    }
    // Also pick up any citations attached to text blocks.
    if (block.type === 'text') {
      const citations = (block as unknown as { citations?: Array<{ url?: string; title?: string }> }).citations
      if (Array.isArray(citations)) {
        for (const c of citations) {
          if (c.url && !seen.has(c.url)) {
            seen.set(c.url, { url: c.url, title: c.title || c.url, type: 'web' })
          }
        }
      }
    }
  }
  return Array.from(seen.values())
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '').trim()
}

function getMeaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2)
}

function isTooSimilar(before: string, after: string): boolean {
  if (normalizeForCompare(before) === normalizeForCompare(after)) return true
  const beforeWords = new Set(getMeaningfulWords(before))
  const afterWords = new Set(getMeaningfulWords(after))
  if (beforeWords.size === 0 || afterWords.size === 0) return false
  const shared = Array.from(beforeWords).filter((word) => afterWords.has(word)).length
  const overlap = shared / Math.max(beforeWords.size, afterWords.size)
  const wordDelta = Math.abs(wordCount(before) - wordCount(after))
  return overlap >= 0.86 && wordDelta < 12
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const { question, context, originalDraft, adminNotes, remixInstruction } = await req.json()
  if (!question || (!context && !adminNotes)) {
    return NextResponse.json({ error: 'question and answer context or admin notes required' }, { status: 400 })
  }
  const previousGeneratedDraft = typeof originalDraft === 'string' ? originalDraft.trim() : ''
  const currentAnswerDraft = typeof context === 'string' ? context.trim() : ''
  const adminInstructions = typeof adminNotes === 'string' ? adminNotes.trim() : ''

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const isShorterRemix = typeof remixInstruction === 'string' && remixInstruction.toLowerCase().includes('shorter')
  const kb = await searchKnowledgeBase(`${question}\n\n${adminInstructions}\n\n${currentAnswerDraft}`.slice(0, 4000))
  const freshnessInstruction = getFreshnessInstruction(`${question}\n${adminInstructions}\n${currentAnswerDraft}`)
  const preferenceContext = await getElijahPreferenceContext()

  const prompt = `Write a completely new answer from scratch to this player's question.

Priority order:
1. Elijah's private remix instructions are the source of truth. They beat the old answer draft, the knowledge base, and web research.
2. Elijah's NEW or CHANGED information in the current answer draft is also source-of-truth material.
3. The previous generated draft is only reference material so you can see what changed. Do not copy it.
4. Elijah's knowledge-base context can support, clarify, or sharpen the answer only when it clearly connects to Elijah's current instructions or edits.
5. Web research is only for fact-checking, neuroscience/psychology/sports-psychology grounding, and avoiding inaccurate mechanism claims.

Your first job is to read Elijah's private remix instructions. If he gave instructions, they must visibly change the answer. Then compare the previous generated draft against the current answer draft. Identify what Elijah added, removed, corrected, emphasized, or changed. Build the new answer around those instructions and new/different information.

If the knowledge base does not intertwine with Elijah's instructions or new/changed information, leave it out. Do not force it in. Do not replace Elijah's opinion with generic sports psychology. If web research contradicts a mechanism claim, rewrite the mechanism so it is accurate while keeping Elijah's core point.

Every remix must follow this answer standard:
1. What the player is feeling.
2. Why it happens, translated into simple psychology or body/brain language.
3. Elijah's credible pro perspective.
4. A clear action plan the player can do today.

Make the psychology easy enough for a young kid to understand, but make the reasoning credible enough that a parent, coach, or sports psych person would respect it.

Use the current answer draft below as raw material only. It may contain a previous draft, notes Elijah jotted in, or a mix of both. Do NOT preserve the old wording, paragraph order, opening, or ending. Imagine the textarea was deleted and you are writing a brand-new answer from a blank page using Elijah's private instructions and new/different information as the spine.

The remix must be materially different from the current answer draft. If Elijah wrote private remix instructions, added new lines, rough thoughts, examples, corrections, or extra coaching points, those additions must visibly change the final answer. Do not return the same answer with tiny wording changes. Change the opening, structure, transitions, and action step so the new information is clearly integrated.

CRITICAL: Return only the words Elijah would say to the player. Never include behind-the-scenes narration, research process, preambles, markdown separators, or model language. Do not write phrases like "Alright, I've got solid research backing," "let me weave this together," "here's the answer," "I researched," "as an AI," "LLM," or anything that sounds like ChatGPT talking. Start directly with the answer to the player.

Requested remix direction:
${remixInstruction || 'General remix: make the answer cleaner, more cohesive, and easier for a young hooper to use.'}

Treat the remix direction as an editing instruction, not as part of the answer. If it asks for shorter, the new answer must be meaningfully shorter than Elijah's current notes/draft and should target 140-180 words unless that would remove the core point. If it asks for more practical, add concrete steps without bloating. If it asks for more Elijah, make the voice more direct and lived-in without adding fake personal stories.

You have web_search and web_fetch. USE THEM proactively. Before stating any mechanism claim (how the brain works under pressure, sleep, nervous-system regulation, HRV, visualization, confidence, recovery — any physiological or psychological "why this works"), verify it with a lookup. Two to four searches is the norm, not the exception.

Ground the answer in real neuroscience, psychology, sports psychology, physiology, or performance research when a mechanism is being explained. But the voice always wins. Never say "studies show" or use footnote-style citations inside the answer. Phrase research in first-person Elijah voice: "the reason this works is your nervous system..." or "I read something from a Stanford lab that said...". The science makes the mechanism credible; Elijah's voice keeps it human. Make it simple, not simplistic. Weave, don't stack.

Also use web_fetch when a URL is pasted in the notes, and verify any specific name, quote, or stat before putting it in Elijah's mouth.
${freshnessInstruction}

Player's question:
"${question}"

Previous generated answer before Elijah edited it:
${previousGeneratedDraft || '(No previous generated answer was provided.)'}

Private remix instructions from Elijah. These are NOT player-facing, but they are the highest priority:
${adminInstructions || '(No private remix instructions were provided.)'}

Current answer draft. Compare this to the previous answer and prioritize what is new or different:
${currentAnswerDraft || '(No current answer draft was provided.)'}

Relevant Elijah knowledge-base context. Use only if it fits Elijah's notes:
${kb.context || '(No relevant knowledge-base context found.)'}
${preferenceContext}

Write the full answer from scratch now:`

  let res: Anthropic.Messages.Message
  try {
    res = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
        { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 5 },
      ],
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    await logError('admin:regenerate-draft:tools', err, { question: question.slice(0, 100) })
    try {
      res = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `${prompt}\n\nWeb tools are unavailable for this retry. Use the knowledge-base context and Elijah's notes only. Still return a materially new, player-facing answer.`,
        }],
      })
    } catch (fallbackErr) {
      await logError('admin:regenerate-draft:fallback', fallbackErr, { question: question.slice(0, 100) })
      return NextResponse.json({ error: 'Remix generation failed. Try again in a moment.' }, { status: 502 })
    }
  }

  // The final text block is the answer. Earlier blocks may be tool calls and
  // tool results that we harvest for sources.
  const textBlocks = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
  let newDraft = sanitizeAnswerText(textBlocks.map((b) => b.text).join('\n\n'))
  if (isTooSimilar(currentAnswerDraft, newDraft)) {
    try {
      const forced = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1400,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Your last remix was effectively unchanged. Rewrite it again so it is clearly a NEW answer.

Rules:
- Keep Elijah's meaning and voice.
- Integrate Elijah's private remix instructions.
- Integrate any added notes, corrections, examples, or rough thoughts from the answer draft.
- Change the opening, structure, and action step.
- Add at least one sentence that was not in the previous answer.
- Remove or rephrase at least one sentence from the previous answer.
- Do not mention that you are remixing.
- Return only the final answer.

Player's question:
"${question}"

Private remix instructions from Elijah:
${adminInstructions || '(No private remix instructions were provided.)'}

Current answer draft that must be transformed:
${currentAnswerDraft}`,
        }],
      })
      const forcedText = forced.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n\n')
        .trim()
      if (forcedText) newDraft = sanitizeAnswerText(forcedText)
    } catch (err) {
      await logError('admin:regenerate-draft:forced-rewrite', err, { question: question.slice(0, 100) })
    }
  }
  if (isShorterRemix && wordCount(newDraft) > 200) {
    try {
      const compressed = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Compress this answer to 140-180 words. This is a hard limit. Keep Elijah's meaning, direct voice, one science-grounded mechanism sentence, and one concrete action step. Remove extra explanation, extra sources, and repeated ideas. Return only the final answer.\n\nQuestion: "${question}"\n\nAnswer to compress:\n${newDraft}`,
        }],
      })
      const compressedText = compressed.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n\n')
        .trim()
      if (compressedText) newDraft = sanitizeAnswerText(compressedText)
    } catch (err) {
      await logError('admin:regenerate-draft:compress', err, { question: question.slice(0, 100) })
    }
  }
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
