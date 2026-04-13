import { NextRequest, NextResponse } from 'next/server'

// Admin endpoint: add Elijah's personal stories to the Pinecone knowledge base.
// Usage: POST /api/add-story with header x-token: CRON_SECRET
// Body: { text: string, title: string, id?: string }
// The id field is optional — if omitted, a slug is generated from the title.

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

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60)
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-token')
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { text, title, id, topic, trigger } = await req.json()

  if (!text?.trim() || !title?.trim()) {
    return NextResponse.json({ error: 'text and title are required' }, { status: 400 })
  }

  const vectorId = id || `story_${slugify(title)}`

  try {
    const embedding = await embedText(text.trim())

    const metadata: Record<string, string> = {
      text: text.trim(),
      source_type: 'personal_story',
      source_title: title.trim(),
    }
    if (topic) metadata.topic = topic
    if (trigger) metadata.trigger = trigger

    const res = await fetch(`${process.env.PINECONE_HOST}/vectors/upsert`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vectors: [{ id: vectorId, values: embedding, metadata }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Pinecone upsert failed: ${err}`)
    }

    return NextResponse.json({ success: true, id: vectorId })
  } catch (err) {
    console.error('add-story error:', err)
    return NextResponse.json({ error: 'Failed to save story' }, { status: 500 })
  }
}
