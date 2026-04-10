import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabase } from '@/lib/supabase-server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

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

async function upsertToPinecone(
  id: string,
  embedding: number[],
  question: string,
  answer: string
) {
  const res = await fetch(`${process.env.PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vectors: [
        {
          id,
          values: embedding,
          metadata: {
            text: answer,
            source_type: 'elijah_correction',
            source_title: 'Direct from Elijah',
            question,
            corrected_at: new Date().toISOString(),
          },
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Pinecone upsert failed: ${res.status}`)
}

export async function POST(req: NextRequest) {
  try {
    // Verify the user is Elijah
    const res = NextResponse.next()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user?.email || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { questionId, question, correctAnswer } = await req.json()

    if (!question?.trim() || !correctAnswer?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Embed the correct answer
    const embedding = await embedText(correctAnswer)

    // Build a stable Pinecone ID from the question ID
    const pineconeId = `correction_${questionId || Date.now()}`

    // Upsert to Pinecone
    await upsertToPinecone(pineconeId, embedding, question, correctAnswer)

    // Update the Supabase record with the corrected answer
    if (questionId) {
      const supabase = getSupabase()
      await supabase
        .from('questions')
        .update({ answer: correctAnswer })
        .eq('id', questionId)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Correction error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
