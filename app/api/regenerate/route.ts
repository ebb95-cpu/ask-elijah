import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { checkLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'

// Web search adds latency; give serverless enough headroom.
export const maxDuration = 60

type WebSource = { title: string; url: string; type: string }

function harvestWebSources(content: Anthropic.Messages.ContentBlock[]): WebSource[] {
  const out: WebSource[] = []
  const seen = new Set<string>()
  for (const block of content) {
    if (block.type === 'web_search_tool_result') {
      const items = (block as unknown as { content: Array<{ url?: string; title?: string }> }).content || []
      for (const item of items) {
        if (item.url && !seen.has(item.url)) {
          seen.add(item.url)
          out.push({ url: item.url, title: item.title || item.url, type: 'web' })
        }
      }
    }
    if (block.type === 'web_fetch_tool_result') {
      const fetched = (block as unknown as { content?: { url?: string; title?: string } }).content
      if (fetched?.url && !seen.has(fetched.url)) {
        seen.add(fetched.url)
        out.push({ url: fetched.url, title: fetched.title || fetched.url, type: 'web' })
      }
    }
    if (block.type === 'text') {
      const citations = (block as unknown as { citations?: Array<{ url?: string; title?: string }> }).citations
      if (Array.isArray(citations)) {
        for (const c of citations) {
          if (c.url && !seen.has(c.url)) {
            seen.add(c.url)
            out.push({ url: c.url, title: c.title || c.url, type: 'web' })
          }
        }
      }
    }
  }
  return out
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-token')
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin-only endpoint, but still rate-limit to stop accidental spam
  // (e.g. a runaway UI retry loop). 30 regens/hour is plenty for one operator.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'admin'
  const limit = await checkLimit('rl:regenerate', ip, 30, '1 h')
  if (!limit.success) {
    return NextResponse.json({ error: 'Regenerate rate limit hit. Wait a few minutes.' }, { status: 429 })
  }

  const { question, draft, context } = await req.json()
  if (!question || !context) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const prompt = `The original question was: "${question}"

Here is the current draft answer:
${draft}

Elijah has added his own real thoughts, stories, or corrections:
${context}

Rewrite the final answer weaving Elijah's additions into the draft. Follow this structure every time:
1. Open by naming the exact pain or feeling they have — make them feel heard immediately
2. Explain WHY this happens (the real mechanism — brain, body, how pressure works) in Elijah's voice, not as a fact recitation. Use web_search to verify the mechanism claim before stating it — 1-2 lookups is the norm.
3. Give the solution grounded in Elijah's personal experience and what he added above
4. End with ONE specific action they must take today — concrete enough that there is no excuse not to do it

Use Elijah's real additions as the core. The draft is just scaffolding. His voice and his experience win every time. Research supports the mechanism; it doesn't replace the voice. Weave, don't stack.
Keep it 4 to 8 sentences. No lists. No em dashes. First person throughout.`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
        { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 5 },
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlocks = response.content.filter(
      (b): b is Anthropic.Messages.TextBlock => b.type === 'text'
    )
    const answer = textBlocks.map((b) => b.text).join('\n\n').trim()
    const sources = harvestWebSources(response.content)
    return NextResponse.json({ answer, sources })
  } catch (err) {
    await logError('regenerate:anthropic', err, { question: question.slice(0, 80) })
    return NextResponse.json({ error: 'Regenerate failed' }, { status: 500 })
  }
}
