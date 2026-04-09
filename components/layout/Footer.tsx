import Link from 'next/link'
import ThreeDots from '@/components/ui/ThreeDots'

export default function Footer() {
  return (
    <footer className="bg-black text-white px-6 py-10 mt-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-3">
            <ThreeDots size={4} color="#fff" />
            <p className="text-xs text-gray-500">Built by Elijah Bryant. Consistency Club.</p>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-gray-500 hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="text-xs text-gray-500 hover:text-white transition-colors">Terms</Link>
            <Link href="mailto:hello@consistencyclub.com" className="text-xs text-gray-500 hover:text-white transition-colors">Contact</Link>
          </div>

          <p className="text-xs text-gray-600">© Consistency Club</p>
        </div>
      </div>
    </footer>
  )
}
