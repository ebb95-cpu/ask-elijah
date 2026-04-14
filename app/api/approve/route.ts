import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

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

async function saveToPinecone(
  questionId: string,
  question: string,
  answer: string,
  opts?: { topic?: string | null; trigger?: string | null; level?: string | null; age_range?: string | null; helpful_count?: number }
) {
  const combined = `Q: ${question}\n\nA: ${answer}`
  const embedding = await embedText(combined)

  const metadata: Record<string, string | number> = {
    text: combined,
    source_type: 'approved_answer',
    source_title: 'Elijah Bryant — Approved Answer',
    question,
    helpful_count: opts?.helpful_count ?? 0,
  }
  if (opts?.topic) metadata.topic = opts.topic
  if (opts?.trigger) metadata.trigger = opts.trigger
  if (opts?.level) metadata.level = opts.level
  if (opts?.age_range) metadata.age_range = opts.age_range

  await fetch(`${process.env.PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vectors: [{
        id: `approved_${questionId}`,
        values: embedding,
        metadata,
      }],
    }),
  })
}

async function backupPineconeLatest(): Promise<void> {
  const pineconeHost = process.env.PINECONE_HOST!
  const pineconeKey = process.env.PINECONE_API_KEY!
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // List all vector IDs with pagination
  const allIds: string[] = []
  let paginationToken: string | undefined

  do {
    const url = new URL(`${pineconeHost}/vectors/list`)
    if (paginationToken) url.searchParams.set('paginationToken', paginationToken)

    const res = await fetch(url.toString(), {
      headers: { 'Api-Key': pineconeKey },
    })
    if (!res.ok) throw new Error(`Pinecone list failed: ${res.status}`)
    const data = await res.json()

    const ids: string[] = (data.vectors || []).map((v: { id: string }) => v.id)
    allIds.push(...ids)
    paginationToken = data.pagination?.next
  } while (paginationToken)

  // Fetch vectors in batches of 100
  const allVectors: unknown[] = []
  for (let i = 0; i < allIds.length; i += 100) {
    const batch = allIds.slice(i, i + 100)
    const params = batch.map(id => `ids=${encodeURIComponent(id)}`).join('&')
    const res = await fetch(`${pineconeHost}/vectors/fetch?${params}`, {
      headers: { 'Api-Key': pineconeKey },
    })
    if (!res.ok) throw new Error(`Pinecone fetch failed: ${res.status}`)
    const data = await res.json()
    allVectors.push(...Object.values(data.vectors || {}))
  }

  // Upload to Supabase Storage as latest.json
  const body = JSON.stringify({ backedUpAt: new Date().toISOString(), vectors: allVectors })
  const uploadRes = await fetch(
    `${supabaseUrl}/storage/v1/object/pinecone-backups/latest.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body,
    }
  )
  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    throw new Error(`Supabase upload failed: ${uploadRes.status} ${text}`)
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-token')
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { questionId, finalAnswer, actionSteps } = await req.json()
  if (!questionId || !finalAnswer) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Fetch question record
  const { data: record, error: fetchError } = await supabase
    .from('questions')
    .select('question, email, sources, topic, trigger')
    .eq('id', questionId)
    .single()

  if (fetchError || !record) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Fetch name + level/age_range for personalization and Pinecone metadata
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, level, age_range')
    .eq('email', record.email.toLowerCase())
    .single()
  const firstName = profile?.first_name || null

  // Update in Supabase
  await supabase
    .from('questions')
    .update({ answer: finalAnswer, status: 'approved', action_steps: actionSteps || null })
    .eq('id', questionId)

  // Send email to user
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'
  await resend.emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
      replyTo: 'ebb95@mac.com',
    to: record.email,
    subject: 'Elijah wrote back.',
    html: `
<!DOCTYPE html>
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

          <!-- Big two-tone headline -->
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Elijah reviewed it.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Here's his answer.</p>

          ${firstName ? `<p style="font-size:15px;color:#ffffff !important;margin:0 0 24px;font-family:-apple-system,sans-serif;">Hey ${firstName}.</p>` : ''}

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:12px;color:#ffffff !important;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">You asked</p>
            <p style="font-size:16px;font-weight:600;margin:0;color:#ffffff !important;line-height:1.5;font-family:-apple-system,sans-serif;">${record.question}</p>
          </div>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 8px;font-family:-apple-system,sans-serif;">He read it, shaped it, and this is what he wants you to know.</p>

          <div style="font-size:16px;line-height:1.8;color:#ffffff !important;white-space:pre-wrap;margin-bottom:32px;font-family:-apple-system,sans-serif;">${finalAnswer.split(' ').slice(0, 40).join(' ')}...</div>

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${siteUrl}/history" style="color:#555555;text-decoration:none;">Read the full answer →</a>
          </p>

          <p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `,
  })

  // Save to Pinecone knowledge base
  try {
    await saveToPinecone(questionId, record.question, finalAnswer, {
      topic: record.topic,
      trigger: record.trigger,
      level: profile?.level ?? null,
      age_range: profile?.age_range ?? null,
    })
  } catch (err) {
    console.warn('Pinecone save failed (non-fatal):', err)
  }

  // Fire-and-forget backup
  void backupPineconeLatest().catch(e => console.warn('Backup failed (non-fatal):', e))

  return NextResponse.json({ success: true })
}
