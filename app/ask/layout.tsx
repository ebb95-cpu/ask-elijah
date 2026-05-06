import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ask Elijah',
  description: "Ask an NBA + EuroLeague champion what's happening in your head.",
  openGraph: {
    title: 'Ask Elijah',
    description: "Ask an NBA + EuroLeague champion what's happening in your head.",
  },
  twitter: {
    title: 'Ask Elijah',
    description: "Ask an NBA + EuroLeague champion what's happening in your head.",
  },
}

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return children
}
