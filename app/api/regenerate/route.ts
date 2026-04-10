import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-token')
    if (!token || token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { question, draft, context } = await req.json()

    if (!question || !context?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const prompt = `A basketball player asked: "${question}"

Here is an AI-generated draft answer:
---
${draft}
---

Here is what Elijah actually wants to say — his real thoughts, corrections, and context he wants included:
---
${context}
---

Rewrite the answer following these rules:

1. Elijah's real words and experiences are the foundation. His input takes priority over the draft. Drop anything from the draft that contradicts him.

2. If Elijah mentions a famous athlete (Kobe, LeBron, MJ, etc.) or a specific training method, use your knowledge of that person or method to add real supporting detail — a known habit, quote, or documented approach that reinforces what Elijah is saying. Keep it brief and woven in naturally.

3. Back every piece of advice with sports science — neuroscience, sports psychology, physiology. Never say "studies show." Weave the science in as the reason WHY the advice works, in Elijah's voice. If you are not confident a scientific claim is accurate, wrap it in: <<VERIFY: the claim>>

4. Keep it in Elijah's voice — first person, conversational, no bullet points, no dashes, no lists. Flowing paragraphs.

5. End with one concrete action the person can take today.`

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    let answer = ''
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      })
      answer = response.content[0].type === 'text' ? response.content[0].text : ''
    } catch {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      })
      answer = response.content[0].type === 'text' ? response.content[0].text : ''
    }

    return NextResponse.json({ answer })
  } catch (err) {
    console.error('Regenerate error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
