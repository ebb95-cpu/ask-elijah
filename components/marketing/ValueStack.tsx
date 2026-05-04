type ValueItem = {
  title: string
  body: string
  value: string
}

export const HOME_VALUE_ITEMS: ValueItem[] = [
  { title: 'Unlimited reviewed questions.', body: '24 to 48 hour answers, reviewed by my standard.', value: 'Value: $200/mo' },
  { title: 'The Weekly Rep.', body: 'Every Sunday. The whole room works on the same mental rep that week.', value: 'Value: $40/mo' },
  { title: 'The Drive Home.', body: 'Weekly voice note from me on one principle. Audio that travels.', value: 'Value: $40/mo' },
  { title: 'Film Notes.', body: "Weekly clip from an NBA or EuroLeague game with my read on what is in the player's head.", value: 'Value: $30/mo' },
  { title: 'Game Day Protocol Cards.', body: 'Pre-game mental routines. New versions every month.', value: 'Value: $20/mo' },
  { title: 'The Locker Room Library.', body: 'Every reviewed answer searchable forever. Grows every week.', value: 'Priceless. Lost the day you cancel.' },
  { title: 'Wins Wall.', body: 'Anonymous wins from the rest of the room.', value: 'Value: $15/mo' },
  { title: '7-day rep follow-up.', body: 'The system asks if you tried it. Tracks what is shifting.', value: 'Value: $15/mo' },
  { title: 'Pro Reset PDF library.', body: 'One new downloadable every month.', value: 'Value: $15 each. $180/year.' },
  { title: 'Source citations on every answer.', body: 'Where it came from. Where to go deeper.', value: 'Included.' },
]

export const PRICING_VALUE_ITEMS: ValueItem[] = [
  { title: 'Unlimited questions, reviewed by my standard.', body: '24 to 48 hour answers. Receipts when they matter.', value: 'Value: $200/mo' },
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
      <p>Total value:   $540/mo</p>
      <p>Your price:    $14.99/mo</p>
      <p>You save:      $525/mo</p>
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
