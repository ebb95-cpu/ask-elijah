/**
 * YouTube pain-point scraper.
 *
 * For each seed query, finds the top videos and pulls their comments.
 * Uses the YouTube Data API v3. Cost per run (rough):
 *   search.list        = 100 units per query
 *   commentThreads.list = 1 unit per video
 * With 12 seed queries and 3 videos each: ~1236 units. Daily free quota
 * is 10,000, so we have headroom.
 *
 * Requires YOUTUBE_API_KEY (a Google Cloud API key with YouTube Data v3
 * enabled). Fails soft — returns [] on any error so one dead source
 * doesn't sink the whole run.
 */

import { RESEARCH_CONFIG } from './config'
import type { RawInsight } from './types'

const API = 'https://www.googleapis.com/youtube/v3'

type Video = { id: string; title: string }

async function searchVideos(query: string, apiKey: string): Promise<Video[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(RESEARCH_CONFIG.youtube.videosPerQuery),
    relevanceLanguage: 'en',
    key: apiKey,
  })
  const res = await fetch(`${API}/search?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.items || [])
    .map((item: { id?: { videoId?: string }; snippet?: { title?: string } }) => ({
      id: item.id?.videoId || '',
      title: item.snippet?.title || '',
    }))
    .filter((v: Video) => v.id)
}

async function fetchComments(video: Video, apiKey: string): Promise<RawInsight[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    videoId: video.id,
    maxResults: String(RESEARCH_CONFIG.youtube.commentsPerVideo),
    order: 'relevance',
    textFormat: 'plainText',
    key: apiKey,
  })
  const res = await fetch(`${API}/commentThreads?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  const items = (data.items || []) as Array<{
    snippet?: {
      topLevelComment?: {
        snippet?: {
          textDisplay?: string
          authorDisplayName?: string
          publishedAt?: string
          likeCount?: number
        }
      }
    }
  }>

  return items.flatMap((item) => {
    const c = item.snippet?.topLevelComment?.snippet
    if (!c?.textDisplay) return []
    return [{
      source: 'youtube' as const,
      source_url: `https://www.youtube.com/watch?v=${video.id}`,
      text: c.textDisplay,
      author: c.authorDisplayName || null,
      created_at: c.publishedAt || null,
      metadata: {
        video_title: video.title,
        like_count: c.likeCount || 0,
      },
    }]
  })
}

export async function collectYouTube(): Promise<RawInsight[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.log('[research:youtube] YOUTUBE_API_KEY not set, skipping')
    return []
  }

  const all: RawInsight[] = []
  for (const query of RESEARCH_CONFIG.seedQueries) {
    try {
      const videos = await searchVideos(query, apiKey)
      for (const video of videos) {
        try {
          const comments = await fetchComments(video, apiKey)
          all.push(...comments)
        } catch (err) {
          console.log(`[research:youtube] comments failed for ${video.id}:`, err)
        }
      }
    } catch (err) {
      console.log(`[research:youtube] search failed for "${query}":`, err)
    }
  }
  return all
}
