'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SlotCounter() {
  const [available, setAvailable] = useState<number | null>(null)

  useEffect(() => {
    const fetchSlots = async () => {
      const today = new Date()
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      const weekStartStr = weekStart.toISOString().split('T')[0]

      const { data } = await supabase
        .from('direct_slots')
        .select('slots_available, slots_booked')
        .eq('week_start', weekStartStr)
        .single()

      if (data) {
        setAvailable(data.slots_available - data.slots_booked)
      } else {
        setAvailable(10) // default
      }
    }

    fetchSlots()
  }, [])

  if (available === null) return null

  return (
    <p className="text-sm text-gray-500">
      <span className={`font-semibold ${available <= 3 ? 'text-black' : 'text-gray-700'}`}>
        {available} of 10 slots available this week.
      </span>
    </p>
  )
}
