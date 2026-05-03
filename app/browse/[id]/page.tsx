import { getSupabase } from '@/lib/supabase-server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSourceAction, getSourceIcon } from '@/lib/source-labels'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

async function fetchQuestion(id: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('questions')
    .select('id, question, answer, topic, created_at, status, sources')
    .eq('id', id)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .single()
  return data
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  const q = await fetchQuestion(id)
  if (!q) return { title: 'Not found' }

  const title = q.question.length > 60 ? q.question.slice(0, 60) + '...' : q.question
  const description = q.answer.length > 160 ? q.answer.slice(0, 160) + '...' : q.answer

  return {
    title: `${title} — Ask Elijah`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function BrowseAnswerPage({ params }: { params: Params }) {
  const { id } = await params
  const q = await fetchQuestion(id)
  if (!q) notFound()

  const formattedDate = new Date(q.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  // JSON-LD for rich snippets — Google QAPage schema
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: q.question,
      text: q.question,
      answerCount: 1,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
        author: {
          '@type': 'Person',
          name: 'Elijah Bryant',
          description: 'Professional basketball player — NBA (Utah Jazz), EuroLeague Champion',
        },
      },
    },
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="flex items-center justify-between px-5 py-5 border-b border-gray-900">
        <Link href="/browse" className="text-gray-500 hover:text-white transition-colors text-sm">
          ← Browse
        </Link>
        <Link href="/ask" className="text-xs font-semibold text-white hover:opacity-70 transition-opacity">
          Ask your own →
        </Link>
      </nav>

      <article className="flex-1 px-5 py-12 max-w-2xl mx-auto w-full">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-6">
          {q.topic ? q.topic : 'Q&A'} · {formattedDate}
        </p>

        <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-10">
          &ldquo;{q.question}&rdquo;
        </h1>

        <div className="border-l-2 border-white pl-6 mb-10">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Elijah's answer</p>
          <div className="text-gray-200 leading-relaxed text-base whitespace-pre-wrap">
            {q.answer}
          </div>
        </div>

        {Array.isArray(q.sources) && q.sources.length > 0 && (
          <div className="border-t border-gray-900 pt-6 mb-12">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">Go deeper</p>
            <div className="flex flex-col gap-2">
              {(q.sources as { title: string; url: string; type: string }[]).slice(0, 4).map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {getSourceIcon(s)}&nbsp;&nbsp;{getSourceAction(s)}: {s.title}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-900 pt-8 mt-12">
          <p className="text-sm text-gray-500 mb-4">Got a different situation on your mind?</p>
          <Link
            href="/ask"
            className="inline-block bg-white text-black px-6 py-3 text-sm font-bold hover:opacity-80 transition-opacity"
          >
            Ask Elijah →
          </Link>
        </div>
      </article>

      <footer className="border-t border-gray-900 px-5 py-6 text-center">
        <p className="text-[11px] text-gray-700 uppercase tracking-widest">
          Elijah Bryant · NBA · EuroLeague Champion
        </p>
      </footer>
    </div>
  )
}
