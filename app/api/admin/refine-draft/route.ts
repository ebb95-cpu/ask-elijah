import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Hard upper bound so a runaway loop can't infinite-call Claude, but high
// enough that Elijah can keep going as deep as he wants on a tough question.
const MAX_ROUNDS = 20

/**
 * Multi-turn refinement: AI reads the current draft + Elijah's rough notes,
 * decides whether it has enough, and either asks Elijah one clarifying
 * question OR produces a final rewritten answer that incorporates everything.
 *
 * Philosophy: keep going as long as Elijah wants. The AI should default to
 * asking another question when there's anything plausibly useful to pull
 * out — only say "done" when it genuinely can't think of anything richer.
 * Elijah decides when to stop by hitting "Write the final now".
 *
 * Final generation also proactively anticipates what the player will push
 * back with or wonder about, and addresses those angles preemptively so
 * the answer feels like every objection was already thought through.
 */
export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      question,
      draft,
      notes,
      conversation,
      forceFinal,
    } = body as {
      question?: string
      draft?: string
      notes?: string
      conversation?: { q: string; a: string }[]
      forceFinal?: boolean
    }

    if (!question || !draft) {
      return NextResponse.json({ error: 'question and draft required' }, { status: 400 })
    }

    const rounds = (conversation || []).length
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // If the caller explicitly wants the final now, or we've hit the max
    // number of clarifying rounds, skip straight to generation.
    const shouldFinalize = forceFinal || rounds >= MAX_ROUNDS

    const convoText = (conversation || [])
      .map((c, i) => `Round ${i + 1}\n  AI asked Elijah: "${c.q}"\n  Elijah answered: "${c.a}"`)
      .join('\n\n')

    if (!shouldFinalize) {
      // Step 1: decide — ask one more question OR mark done
      const decidePrompt = `You are helping Elijah Bryant polish an answer he's about to send a basketball player. Your goal is to keep refining with him until the answer would cover every angle a real player would wonder about — so when they read it, they think "he thought of everything."

You have:

1. The player's original question:
"${question}"

2. The current draft answer:
"""
${draft}
"""

3. Elijah's rough notes / additions he wants woven in:
"""
${notes || '(nothing yet)'}
"""

${convoText ? `You've already had this clarifying conversation with Elijah:\n\n${convoText}\n\n` : ''}

Your job right now: ask Elijah ONE more specific question that would make the final answer richer. You should almost always ask another one — only stop (done: true) when you genuinely can't think of anything else that would add depth, or when the answer would already cover every reasonable follow-up the player might have.

Categories of questions that unlock depth (cycle through these as the conversation develops):
- Concrete stories: "was there a specific game this came up for you?"
- Sensory detail: "what did it feel like in your body when that happened?"
- Exact words: "what did your coach actually say?"
- Pushback simulation: "what would you say to a player who told you they already tried that?"
- Counter-examples: "when does this advice NOT apply?"
- Identity: "what did you tell yourself in that moment?"
- People: "who did you lean on when it was worst?"
- Science: "is there anything about the brain or body that makes this work?"
- The thing they WON'T want to hear but need to: "what's the hard truth here?"

Return JSON only:
{"done": true} if the answer is already comprehensive and any more detail would bloat it.
{"done": false, "question": "<one specific question for Elijah>"} otherwise.

Rules:
- NEVER ask more than one question at a time.
- Don't repeat a category you've already asked about in this conversation — pull from a different angle.
- Don't ask about the PLAYER — you can't see them. Ask about Elijah's experience, stories, or what he'd say to push back.
- If Elijah just gave you a story, follow up on a specific detail from it, not a generic "anything else?"`

      const decideRes = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 250,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: decidePrompt }],
      })

      const raw = decideRes.content[0].type === 'text' ? decideRes.content[0].text.trim() : '{}'
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      let parsed: { done?: boolean; question?: string } = {}
      try {
        parsed = JSON.parse(clean)
      } catch {
        // If the model didn't return JSON, default to finalize.
      }

      if (parsed.done === false && parsed.question && typeof parsed.question === 'string') {
        return NextResponse.json({
          done: false,
          followUp: parsed.question,
          round: rounds + 1,
          roundsRemaining: MAX_ROUNDS - (rounds + 1),
        })
      }
      // Fall through to finalize
    }

    // Step 2: finalize — anticipate pushback, then rewrite
    // First, have the model imagine what the player would push back with or
    // wonder about after reading the current material. Then feed those
    // anticipated objections into the final write so they get addressed
    // preemptively. This is what makes the answer feel like "he thought of
    // every angle."
    const pushbackPrompt = `A basketball player asked: "${question}"

Here's what Elijah plans to tell them, pulled from a draft plus his notes and a clarifying conversation:

DRAFT:
"""
${draft}
"""

ELIJAH'S NOTES:
"""
${notes || '(none)'}
"""

${convoText ? `CONVERSATION WITH ELIJAH:\n${convoText}\n\n` : ''}

Imagine you are the PLAYER reading Elijah's response. List the 2-4 things you would push back on, wonder about, or still feel unsatisfied with. Think: "yeah but what about..." or "I already tried that..." or "easy for him to say, he's a pro..." or "what if X happens..." — the real objections.

Return JSON only: {"pushbacks": ["first objection in the player's voice", "second", ...]}
Keep each pushback under 20 words, in the player's voice, specific to what they just read.`

    let pushbacks: string[] = []
    try {
      const pbRes = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: pushbackPrompt }],
      })
      const raw = pbRes.content[0].type === 'text' ? pbRes.content[0].text.trim() : '{}'
      const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(clean) as { pushbacks?: string[] }
      if (Array.isArray(parsed.pushbacks)) pushbacks = parsed.pushbacks.slice(0, 4)
    } catch {
      // If the pushback step fails, fall through to a normal finalize
    }

    const pushbackSection = pushbacks.length > 0
      ? `\n\nBEFORE WRITING, anticipate the player's pushback. They will be thinking:\n${pushbacks.map((p) => `- "${p}"`).join('\n')}\n\nWrite the answer in a way that preemptively addresses each of those without calling them out explicitly. The player should feel like you already thought of everything they might object to.`
      : ''

    const finalPrompt = `Write a completely new polished answer to the player's question. Weave in Elijah's notes AND everything he said during the refinement conversation. Do not reference the old draft, do not append — produce ONE cohesive final answer as if you knew all this from the start. Structure: pain → mechanism → solution → one concrete action today.

Player's question:
"${question}"

Current draft (scaffolding only, Elijah's voice and experience from the notes/Q&A should take priority):
"""
${draft}
"""

Elijah's notes:
"""
${notes || '(none)'}
"""

${convoText ? `Clarifying Q&A with Elijah:\n\n${convoText}\n\n` : ''}${pushbackSection}

Write the full answer now. Length: however long it needs to be to cover every angle without padding — typically 8 to 14 sentences when the Q&A was deep. No lists. No em-dashes. First person. Same conversational voice as always.`

    const finalRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: finalPrompt }],
    })

    const newDraft = finalRes.content[0].type === 'text' ? finalRes.content[0].text.trim() : ''
    if (!newDraft || newDraft.length < 30) {
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }

    return NextResponse.json({ done: true, draft: newDraft, pushbacksAnticipated: pushbacks })
  } catch (err) {
    await logError('admin:refine-draft', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refine failed' },
      { status: 500 }
    )
  }
}
