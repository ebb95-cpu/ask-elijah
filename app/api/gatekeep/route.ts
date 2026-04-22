import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkLimit } from '@/lib/rate-limit'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'

/**
 * Question gatekeeper. Runs BEFORE /api/preview streams anything.
 *
 * Classifies the player's question into one of four buckets using a small
 * Haiku call so the preview stream, Supabase insert, and notification email
 * never fire on abuse, gibberish, or off-topic input.
 *
 *   - legit      -> pass through, preview runs as normal
 *   - abuse      -> block, return a brand-safe refusal
 *   - gibberish  -> block, ask for a real question
 *   - off_topic  -> block, redirect to basketball / mental-game scope
 *
 * The LLM reads the full question semantically, not via regex, so it catches
 * "how are you so stupid" and similar creative insults the legacy blocklist
 * in /api/ask misses. Player profile (level, position, challenge, etc.) is
 * optionally fed in so the classifier has the same context as the downstream
 * preview route and doesn't false-positive on nuance like "I feel stupid out
 * there."
 *
 * Failure mode: if Haiku errors or returns unparseable JSON, we fail OPEN
 * (classification = legit) so a service blip never blocks real questions.
 */

type Classification = 'legit' | 'abuse' | 'gibberish' | 'off_topic'

type Profile = {
  first_name?: string
  position?: string
  level?: string
  country?: string
  challenge?: string
}

// Messages shown to the player when a class is rejected. First person Elijah
// voice, no em dashes, direct but not preachy. Voice rules live in
// lib/system-prompt.ts; duplicated tone here because these strings are static
// and we never want Claude improvising the refusal copy.
const REFUSALS: Record<Exclude<Classification, 'legit'>, string> = {
  abuse:
    "That's not the kind of question I answer. Ask me something real about your game.",
  gibberish:
    "That doesn't look like a real question. Try again with something specific I can actually help you with.",
  off_topic:
    "I only answer questions about basketball, mindset, and the stuff around your game. Ask me about that and I'll get you something real.",
}

function profileLines(p: Profile | undefined): string {
  if (!p) return ''
  const parts: string[] = []
  if (p.first_name) parts.push(`First name: ${p.first_name}`)
  if (p.level) parts.push(`Level: ${p.level}`)
  if (p.position) parts.push(`Position: ${p.position}`)
  if (p.country) parts.push(`Country: ${p.country}`)
  if (p.challenge) parts.push(`Biggest challenge: ${p.challenge}`)
  return parts.length ? `\n\nContext about this player:\n${parts.join('\n')}\n` : ''
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'

  // Cheap guardrail against anonymous abuse — 30 classifications per hour is
  // plenty for real users (who usually submit once or twice) and kills bots.
  const limit = await checkLimit('rl:gatekeep', ip, 30, '1 h')
  if (!limit.success) {
    return NextResponse.json(
      { classification: 'legit' as Classification, reason: 'rate-limit-failopen' },
    )
  }

  let body: { question?: string; profile?: Profile }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const question = (body.question || '').trim()
  if (!question) {
    return NextResponse.json({ error: 'Question required' }, { status: 400 })
  }
  if (question.length > 500) {
    return NextResponse.json({ error: 'Question too long' }, { status: 400 })
  }

  const prompt = `You are the incoming-question gatekeeper for Ask Elijah, a site where basketball players ask NBA/EuroLeague player Elijah Bryant about their game. Classify this submission into exactly one bucket.

BUCKETS:
- legit: a real question about basketball, mental game, training, recovery, nutrition, sleep, nerves, pressure, confidence, slumps, coach relationships, playing time, team dynamics, parents/family around sports, identity as a player, motivation, mindset, routines, or anything adjacent that a serious basketball player would genuinely want Elijah's take on. Vague legit questions ("how do I eat better", "how do I get more confidence") still count as legit. Emotional phrasing like "I feel stupid out there" is legit (it's self-reflection, not abuse).
- abuse: insults, hostility, or trolling aimed at Elijah. Examples: "you suck", "how are you so stupid", "why are you so bad at basketball", slurs, threats, fan-of-another-team bait. Swearing used AT Elijah is abuse. Swearing used to describe the player's own frustration is NOT abuse.
- gibberish: random letters, nonsense, empty or near-empty prompts, keyboard mashing, test strings like "asdfasdf", or questions so garbled they can't be parsed.
- off_topic: coherent questions that have nothing to do with basketball, mental performance, or the player's life around their game. Examples: "how do I fix my car", "what's the weather", coding help, cooking recipes unrelated to athletic nutrition.

Question: "${question}"${profileLines(body.profile)}

Return ONLY valid JSON, no preamble, no code fences:
{"classification": "legit"} OR {"classification": "abuse"} OR {"classification": "gibberish"} OR {"classification": "off_topic"}`

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 40,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed: { classification?: string } = {}
    try {
      parsed = JSON.parse(clean)
    } catch {
      // Unparseable model output — let the question through rather than
      // falsely blocking a real player because Haiku returned something weird.
      return NextResponse.json({ classification: 'legit' as Classification, reason: 'parse-failopen' })
    }

    const cls = parsed.classification
    if (cls === 'legit') {
      return NextResponse.json({ classification: 'legit' as Classification })
    }
    if (cls === 'abuse' || cls === 'gibberish' || cls === 'off_topic') {
      return NextResponse.json({
        classification: cls as Classification,
        reason: REFUSALS[cls],
      })
    }

    // Unknown value — fail open.
    return NextResponse.json({ classification: 'legit' as Classification, reason: 'unknown-class-failopen' })
  } catch (err) {
    await logError('gatekeep:anthropic', err, { question: question.slice(0, 80) })
    // Fail open: a Haiku outage shouldn't take down the funnel.
    return NextResponse.json({ classification: 'legit' as Classification, reason: 'error-failopen' })
  }
}
