import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'For Parents - Ask Elijah',
  description: "Your son is grinding. He's still freezing in games. This is for the part nobody trained.",
  openGraph: {
    title: 'For Parents - Ask Elijah',
    description: "Your son is grinding. He's still freezing in games. This is for the part nobody trained.",
  },
  twitter: {
    title: 'For Parents - Ask Elijah',
    description: "Your son is grinding. He's still freezing in games. This is for the part nobody trained.",
  },
}

export default function ParentsLayout({ children }: { children: React.ReactNode }) {
  return children
}
