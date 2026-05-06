import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Browse Answers - Ask Elijah',
  description: 'Every question Elijah has answered.',
  openGraph: {
    title: 'Browse Answers - Ask Elijah',
    description: 'Every question Elijah has answered.',
  },
  twitter: {
    title: 'Browse Answers - Ask Elijah',
    description: 'Every question Elijah has answered.',
  },
}

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children
}
