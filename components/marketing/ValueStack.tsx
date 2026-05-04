type ValueItem = {
  title: string
  body: string
  value: string
}

export const HOME_VALUE_ITEMS: ValueItem[] = [
  { title: 'Unlimited reviewed questions.', body: 'Ask what is actually happening in your game. I review the answers before they reach you.', value: 'Core access.' },
  { title: 'Apply it. Then report back.', body: 'The follow-up matters as much as the question. Tell me what you tried and what changed.', value: 'This is how the room gets built.' },
  { title: 'Earned deeper review.', body: 'The most engaged players can submit clips or situations for deeper breakdowns as the room develops.', value: 'Activity means application.' },
  { title: 'The Locker Room Library.', body: 'Reviewed answers become a searchable library for the room. It grows from real questions.', value: 'Built by the Founders.' },
  { title: 'Founders shape the roadmap.', body: 'Your questions, follow-ups, clips, and feedback decide what gets built next.', value: 'Early seat. Real influence.' },
  { title: 'Bonus drops when they are ready.', body: 'Voice notes, film notes, PDFs, protocols, and other tools can be added as the room proves what it needs.', value: 'No fake promises.' },
  { title: 'Locked Founders rate.', body: 'Founders keep $9.99/mo for life as long as the membership stays active.', value: 'The early-builder discount.' },
]

export const PRICING_VALUE_ITEMS: ValueItem[] = [
  { title: 'Unlimited reviewed questions.', body: '24 to 48 hour answers when possible. Reviewed by my standard before they reach you.', value: 'Core access.' },
  ...HOME_VALUE_ITEMS.slice(1),
]

export function ValueStack({ items = HOME_VALUE_ITEMS }: { items?: ValueItem[] }) {
  return (
    <div className="divide-y divide-gray-900 border-y border-gray-900">
      {items.map((item) => (
        <div key={item.title} className="py-5">
          <p className="text-lg font-black leading-tight text-white">{item.title}</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-500">{item.body}</p>
          <p className="mt-2 text-sm font-black leading-relaxed text-[#F7F5F0]">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

export function MathReveal({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`mt-8 rounded-[1.5rem] border ${dark ? 'border-gray-900 bg-black' : 'border-gray-900 bg-[#050505]'} p-6 font-mono text-lg font-black leading-loose text-white tabular-nums sm:text-2xl`}>
      <p>Founders:      $9.99/mo</p>
      <p>Locker Room:   $14.99/mo</p>
      <p>Founders keep: the early rate</p>
    </div>
  )
}

export function RiskReversal({ parent = false }: { parent?: boolean }) {
  return (
    <div className="mt-8 border-l-[3px] border-white bg-[#050505] p-8">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#F7F5F0]">
        30 DAYS. NO QUESTIONS.
      </p>
      <p className="mt-4 max-w-3xl text-base font-semibold leading-relaxed text-gray-300">
        {parent
          ? 'If his head is not clearer in 30 days, full refund. The risk is mine. Not yours.'
          : 'If your head is not clearer in 30 days, full refund. The risk is mine. Not yours. The work is yours.'}
      </p>
    </div>
  )
}
