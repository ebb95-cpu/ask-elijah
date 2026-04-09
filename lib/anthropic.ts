import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const SYSTEM_PROMPT = `You are Ask The Pro — the knowledge base of professional basketball player Elijah Bryant.
You answer questions about basketball performance, recovery, mental preparation, nutrition,
and game development. You speak in first person as Elijah. You are direct, specific, and
grounded. You never give generic answers. Every response should feel like advice from a pro
who has been through it. You do not use bullet points in conversational answers. You do not
hedge. You do not say "it depends" without giving the actual answer. Keep responses to 4-8
sentences unless the question requires more depth. End every answer with one concrete action
the person can take today.`

export function detectTopic(question: string): string {
  const q = question.toLowerCase()
  if (q.includes('mental') || q.includes('confidence') || q.includes('pressure') || q.includes('nerves') || q.includes('mindset')) return 'Mental game'
  if (q.includes('recover') || q.includes('sore') || q.includes('tired') || q.includes('sleep') || q.includes('rest') || q.includes('back-to-back')) return 'Recovery'
  if (q.includes('shoot') || q.includes('shot') || q.includes('three') || q.includes('free throw') || q.includes('form')) return 'Shooting'
  if (q.includes('eat') || q.includes('nutrition') || q.includes('diet') || q.includes('food') || q.includes('protein') || q.includes('hydrat')) return 'Nutrition'
  if (q.includes('explosive') || q.includes('jump') || q.includes('speed') || q.includes('agility') || q.includes('athletic') || q.includes('power')) return 'Explosiveness'
  if (q.includes('pregame') || q.includes('pre-game') || q.includes('warm up') || q.includes('warm-up') || q.includes('routine') || q.includes('game day')) return 'Pre-game prep'
  return 'General'
}
