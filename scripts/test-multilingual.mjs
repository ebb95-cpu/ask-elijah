/**
 * Tests multilingual detection + translation + response language.
 * Calls the detectLanguage logic directly using the same Anthropic model.
 *
 * Run: node scripts/test-multilingual.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envLines = readFileSync(join(__dirname, '..', '.env.production.local'), 'utf8').split('\n')
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const testCases = [
  { lang: 'Spanish',    text: '¿Cómo puedo mejorar mi confianza antes de un partido importante?' },
  { lang: 'Turkish',    text: 'Önemli bir maçtan önce güvenimi nasıl artırabilirim?' },
  { lang: 'Hebrew',     text: 'איך אני יכול לשפר את הביטחון שלי לפני משחק חשוב?' },
  { lang: 'Serbian',    text: 'Kako mogu poboljšati samopouzdanje pre važne utakmice?' },
  { lang: 'Greek',      text: 'Πώς μπορώ να βελτιώσω την αυτοπεποίθησή μου πριν από έναν σημαντικό αγώνα;' },
  { lang: 'Bulgarian',  text: 'Как мога да подобря увереността си преди важен мач?' },
  { lang: 'French',     text: 'Comment puis-je améliorer ma confiance avant un match important?' },
  { lang: 'Portuguese', text: 'Como posso melhorar minha confiança antes de um jogo importante?' },
  { lang: 'Italian',    text: 'Come posso migliorare la mia fiducia prima di una partita importante?' },
  { lang: 'German',     text: 'Wie kann ich mein Selbstvertrauen vor einem wichtigen Spiel verbessern?' },
  { lang: 'Croatian',   text: 'Kako mogu poboljšati samopouzdanje prije važne utakmice?' },
  { lang: 'Arabic',     text: 'كيف يمكنني تحسين ثقتي بنفسي قبل مباراة مهمة؟' },
  { lang: 'English',    text: 'How can I improve my confidence before an important game?' },
]

async function detectLanguage(text) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Detect the language of this text. If it is not English, provide a natural English translation.\n\nReturn JSON only: {"language": "English", "translation": null} for English, or {"language": "Greek", "translation": "..."} for other languages.\n\nText: ${text}`,
      }],
    }),
  })
  const data = await res.json()
  const raw = data.content?.[0]?.text || '{}'
  const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}')
  return { language: parsed.language || 'Unknown', translation: parsed.translation || null }
}

console.log('Testing language detection across all supported languages...\n')

let passed = 0
let failed = 0

for (const { lang, text } of testCases) {
  const result = await detectLanguage(text)
  const detectedCorrectly = result.language.toLowerCase().includes(lang.toLowerCase()) ||
    lang.toLowerCase().includes(result.language.toLowerCase())
  const hasTranslation = lang === 'English' ? result.translation === null : !!result.translation

  const status = detectedCorrectly && hasTranslation ? '✅' : '❌'
  if (detectedCorrectly && hasTranslation) passed++; else failed++

  console.log(`${status} ${lang.padEnd(12)} → detected: "${result.language}"`)
  if (result.translation) console.log(`             translation: "${result.translation}"`)
}

console.log(`\n${passed}/${testCases.length} passed`)
if (failed > 0) console.log(`${failed} failed — check output above`)
