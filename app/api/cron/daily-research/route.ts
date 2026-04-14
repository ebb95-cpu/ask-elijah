import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SUBREDDITS = ['Basketball', 'CollegeBasketball', 'hoop', 'basketballcoaching', 'BasketballTips']

interface RedditPost {
  title: string
  selftext: string
  permalink: string
  subreddit: string
  id: string
}

interface RedditApiResponse {
  data: {
    children: { data: RedditPost }[]
  }
}

interface FilteredQuestion {
  index: number
  cleaned_question: string
}

interface KbSource {
  title: string
  url: string
  type: string
  text: string
}

interface PineconeMatch {
  score: number
  metadata: Record<string, string>
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

async function fetchRedditPosts(subreddit: string): Promise<RedditPost[]> {
  try {
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/new.json?limit=50`, {
      headers: { 'User-Agent': 'AskElijah/1.0' },
    })
    if (!res.ok) return []
    const data: RedditApiResponse = await res.json()
    return (data.data?.children || []).map(c => c.data)
  } catch {
    return []
  }
}

async function fetchRedditSearch(): Promise<RedditPost[]> {
  try {
    const res = await fetch(
      'https://www.reddit.com/r/Basketball/search.json?q=how+do+I+improve&sort=new&t=day&limit=25',
      { headers: { 'User-Agent': 'AskElijah/1.0' } }
    )
    if (!res.ok) return []
    const data: RedditApiResponse = await res.json()
    return (data.data?.children || []).map(c => c.data)
  } catch {
    return []
  }
}

async function filterWithClaude(posts: RedditPost[]): Promise<FilteredQuestion[]> {
  const anthropic = getAnthropic()
  const results: FilteredQuestion[] = []

  // Process in batches of 20
  for (let i = 0; i < posts.length; i += 20) {
    const batch = posts.slice(i, i + 20)
    const formatted = batch
      .map((p, idx) => `[${idx}] Title: ${p.title}\nBody: ${p.selftext?.slice(0, 300) || '(no body)'}`)
      .join('\n\n---\n\n')

    try {
      const res = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are filtering Reddit posts for an Ask Elijah basketball mentorship app. Return ONLY posts that are genuine questions or pain points from young basketball players trying to improve their game, mindset, or skills.

EXCLUDE: highlights, predictions, drama, news, trades, debates, team discussions, player opinions.
INCLUDE: questions about improving skills, mental performance, handling pressure, consistency, confidence, slumps, coaching situations, playing time, personal development.

For each valid post, clean the question into a single clear, first-person sentence (how young player would ask a mentor).

Posts to evaluate:
${formatted}

Return a JSON array of objects: [{"index": 0, "cleaned_question": "..."}, ...]
Return [] if none qualify. Return only valid JSON, nothing else.`,
          },
        ],
      })

      const text = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]'
      // Extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      const parsed: FilteredQuestion[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

      for (const item of parsed) {
        if (typeof item.index === 'number' && item.cleaned_question) {
          results.push({
            index: i + item.index,
            cleaned_question: item.cleaned_question,
          })
        }
      }
    } catch (err) {
      console.warn('Claude filter batch failed:', err)
    }
  }

  return results
}

async function embedText(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage embed failed: ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding
}

async function searchPinecone(embedding: number[]): Promise<{ matches: PineconeMatch[]; kbSources: KbSource[] }> {
  const res = await fetch(`${process.env.PINECONE_HOST}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vector: embedding, topK: 4, includeMetadata: true }),
  })
  if (!res.ok) throw new Error(`Pinecone query failed: ${res.status}`)
  const data = await res.json()
  const matches: PineconeMatch[] = (data.matches || []).filter((m: PineconeMatch) => m.score > 0.35)

  const kbSources: KbSource[] = matches
    .map((m) => ({
      title: m.metadata.source_title || 'Elijah Bryant',
      url: m.metadata.source_url || m.metadata.video_url || '',
      type: m.metadata.source_type || 'video',
      text: m.metadata.text || '',
    }))
    .filter((s) => s.text)

  return { matches, kbSources }
}

async function generateDraftAnswer(cleanedQuestion: string, kbSources: KbSource[]): Promise<string> {
  const anthropic = getAnthropic()
  const context =
    kbSources.length > 0
      ? `Here is relevant content from Elijah's knowledge base:\n\n${kbSources.map((s) => `[From: ${s.title}]\n${s.text}`).join('\n\n---\n\n')}\n\n`
      : ''

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `${context}Answer this question from a young basketball player:\n\n${cleanedQuestion}`,
      },
    ],
  })

  return res.content[0].type === 'text' ? res.content[0].text : ''
}

async function sendSummaryEmail(pendingCount: number, autoAnsweredCount: number) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'

  await resend.emails.send({
    from: 'Ask Elijah <elijah@elijahbryant.pro>',
    to: process.env.ADMIN_EMAIL!,
    subject: `${pendingCount} new question${pendingCount !== 1 ? 's' : ''} from Reddit — ready to review`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;">
    <tr><td align="center" bgcolor="#000000" style="background-color:#000000;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;">

          <p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p>

          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">${pendingCount} new question${pendingCount !== 1 ? 's' : ''}.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Ready for your review.</p>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 24px;font-family:-apple-system,sans-serif;">
            The daily Reddit research pulled in new questions from young players. Here's what came in today:
          </p>

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:48px;">
            <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0;font-family:-apple-system,sans-serif;">
              ${pendingCount} question${pendingCount !== 1 ? 's' : ''} need your answer<br>
              ${autoAnsweredCount} auto-answered from the knowledge base
            </p>
          </div>

          <p style="font-size:13px;color:#555555;text-decoration:none;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${siteUrl}/admin/questions" style="color:#555555;text-decoration:none;">Open question queue →</a>
          </p>

          <p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  let newPendingCount = 0
  let autoAnsweredCount = 0
  let skippedDuplicates = 0

  try {
    // 1. Scrape Reddit
    const allPostsMap = new Map<string, RedditPost>()

    const [searchPosts, ...subPosts] = await Promise.all([
      fetchRedditSearch(),
      ...SUBREDDITS.map(fetchRedditPosts),
    ])

    for (const post of [...searchPosts, ...subPosts.flat()]) {
      if (post.id) allPostsMap.set(post.id, post)
    }

    const allPosts = Array.from(allPostsMap.values())
    console.log(`Fetched ${allPosts.length} unique Reddit posts`)

    if (allPosts.length === 0) {
      return NextResponse.json({ pending: 0, autoAnswered: 0, duplicates: 0, message: 'No posts fetched' })
    }

    // 2. Filter with Claude
    const filtered = await filterWithClaude(allPosts)
    console.log(`Claude filtered to ${filtered.length} valid questions`)

    // 3. Process each valid question
    for (const { index, cleaned_question } of filtered) {
      const post = allPosts[index]
      if (!post) continue

      // 4. Check for duplicates
      const { data: existing } = await supabase
        .from('pain_points')
        .select('id')
        .eq('cleaned_question', cleaned_question)
        .limit(1)
        .single()

      if (existing) {
        skippedDuplicates++
        continue
      }

      const sourceUrl = `https://reddit.com${post.permalink}`
      const originalText = `${post.title}\n\n${post.selftext || ''}`.trim()

      // 5. Embed the cleaned question
      let embedding: number[]
      try {
        embedding = await embedText(cleaned_question)
      } catch (err) {
        console.warn('Embed failed for question, skipping:', err)
        continue
      }

      // 6. Search Pinecone
      let matches: PineconeMatch[] = []
      let kbSources: KbSource[] = []
      try {
        const result = await searchPinecone(embedding)
        matches = result.matches
        kbSources = result.kbSources
      } catch (err) {
        console.warn('Pinecone search failed:', err)
      }

      const bestScore = matches.length > 0 ? matches[0].score : 0

      // 7. Determine status and generate draft
      if (bestScore > 0.6) {
        // Auto-answered from KB
        await supabase.from('pain_points').insert({
          source: 'reddit',
          source_url: sourceUrl,
          source_context: post.subreddit,
          original_text: originalText,
          cleaned_question,
          status: 'auto_answered',
          kb_sources: kbSources,
        })
        autoAnsweredCount++
      } else {
        // Generate a draft answer
        let draftAnswer = ''
        try {
          draftAnswer = await generateDraftAnswer(cleaned_question, kbSources)
        } catch (err) {
          console.warn('Draft generation failed:', err)
        }

        await supabase.from('pain_points').insert({
          source: 'reddit',
          source_url: sourceUrl,
          source_context: post.subreddit,
          original_text: originalText,
          cleaned_question,
          status: 'pending',
          draft_answer: draftAnswer || null,
          kb_sources: kbSources,
        })
        newPendingCount++
      }
    }

    // 8. Send summary email if there are new pending questions
    if (newPendingCount > 0) {
      try {
        await sendSummaryEmail(newPendingCount, autoAnsweredCount)
      } catch (err) {
        console.warn('Summary email failed:', err)
      }
    }

    console.log(`Daily research complete — pending: ${newPendingCount}, auto-answered: ${autoAnsweredCount}, duplicates: ${skippedDuplicates}`)

    return NextResponse.json({
      pending: newPendingCount,
      autoAnswered: autoAnsweredCount,
      duplicates: skippedDuplicates,
    })
  } catch (err) {
    console.error('Daily research error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
