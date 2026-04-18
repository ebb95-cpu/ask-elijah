/**
 * Reddit pain-point scraper.
 *
 * For each seed query, searches Reddit inside the configured subreddits and
 * pulls the top posts + top comments. Reddit is the highest signal-to-noise
 * source for this demographic — people vent real pain in threads here.
 *
 * Uses Reddit's OAuth2 flow via client credentials grant. Requires:
 *   REDDIT_CLIENT_ID
 *   REDDIT_CLIENT_SECRET
 *   REDDIT_USER_AGENT  (format: "ask-elijah/1.0 by /u/<username>")
 *
 * Fails soft on any error.
 */

import { RESEARCH_CONFIG } from './config'
import type { RawInsight } from './types'

async function getToken(): Promise<string | null> {
  const id = process.env.REDDIT_CLIENT_ID
  const secret = process.env.REDDIT_CLIENT_SECRET
  const ua = process.env.REDDIT_USER_AGENT
  if (!id || !secret || !ua) return null

  const auth = Buffer.from(`${id}:${secret}`).toString('base64')
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'User-Agent': ua,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.access_token || null
}

type RedditPost = {
  id: string
  permalink: string
  title: string
  selftext: string
  score: number
  author: string
  subreddit: string
  created_utc: number
  num_comments: number
}

async function searchSubreddit(
  subreddit: string,
  query: string,
  token: string,
  ua: string
): Promise<RedditPost[]> {
  const params = new URLSearchParams({
    q: query,
    restrict_sr: '1',
    sort: 'relevance',
    t: 'year',
    limit: String(RESEARCH_CONFIG.reddit.postsPerQuery),
  })
  const res = await fetch(`https://oauth.reddit.com/r/${subreddit}/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': ua,
    },
  })
  if (!res.ok) return []
  const data = await res.json()
  const children = (data.data?.children || []) as Array<{ data: RedditPost }>
  return children
    .map((c) => c.data)
    .filter((p) => p && p.score >= RESEARCH_CONFIG.reddit.minScore)
}

async function fetchComments(
  post: RedditPost,
  token: string,
  ua: string
): Promise<RawInsight[]> {
  const res = await fetch(
    `https://oauth.reddit.com/comments/${post.id}?limit=${RESEARCH_CONFIG.reddit.commentsPerPost}&sort=top`,
    { headers: { Authorization: `Bearer ${token}`, 'User-Agent': ua } }
  )
  if (!res.ok) return []
  const data = await res.json()
  // Reddit returns [post_listing, comment_listing]
  const commentListing = Array.isArray(data) ? data[1] : null
  const children = commentListing?.data?.children || []

  const insights: RawInsight[] = []

  // Include the post itself (title + body) as an insight.
  const postText = [post.title, post.selftext].filter(Boolean).join('\n\n')
  if (postText.trim()) {
    insights.push({
      source: 'reddit',
      source_url: `https://reddit.com${post.permalink}`,
      text: postText,
      author: post.author || null,
      created_at: new Date(post.created_utc * 1000).toISOString(),
      metadata: {
        kind: 'post',
        subreddit: post.subreddit,
        score: post.score,
        num_comments: post.num_comments,
      },
    })
  }

  for (const child of children as Array<{
    kind: string
    data: { body?: string; author?: string; score?: number; created_utc?: number; id?: string }
  }>) {
    if (child.kind !== 't1') continue
    const body = child.data.body
    if (!body || body === '[deleted]' || body === '[removed]') continue
    insights.push({
      source: 'reddit',
      source_url: `https://reddit.com${post.permalink}`,
      text: body,
      author: child.data.author || null,
      created_at: child.data.created_utc
        ? new Date(child.data.created_utc * 1000).toISOString()
        : null,
      metadata: {
        kind: 'comment',
        subreddit: post.subreddit,
        score: child.data.score || 0,
      },
    })
  }

  return insights
}

export async function collectReddit(): Promise<RawInsight[]> {
  const token = await getToken()
  const ua = process.env.REDDIT_USER_AGENT
  if (!token || !ua) {
    console.log('[research:reddit] Reddit credentials missing, skipping')
    return []
  }

  const all: RawInsight[] = []
  const seenPostIds = new Set<string>()

  for (const subreddit of RESEARCH_CONFIG.subreddits) {
    for (const query of RESEARCH_CONFIG.seedQueries) {
      try {
        const posts = await searchSubreddit(subreddit, query, token, ua)
        for (const post of posts) {
          if (seenPostIds.has(post.id)) continue
          seenPostIds.add(post.id)
          try {
            const comments = await fetchComments(post, token, ua)
            all.push(...comments)
          } catch (err) {
            console.log(`[research:reddit] comments failed for ${post.id}:`, err)
          }
        }
      } catch (err) {
        console.log(`[research:reddit] search failed r/${subreddit} "${query}":`, err)
      }
    }
  }
  return all
}
