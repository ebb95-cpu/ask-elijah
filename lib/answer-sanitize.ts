const META_LINE_PATTERNS = [
  /\b(alright|okay|ok)[,\s]+i(?:'|’)ve got\b/i,
  /\bsolid research backing\b/i,
  /\blet me\b.*\b(weave|pull|put|craft|write|answer)\b/i,
  /\bi(?:'|’)ll\b.*\b(weave|pull|put|craft|write|answer)\b/i,
  /\bhere(?:'|’)s\b.*\b(answer|rewrite|draft|version)\b/i,
  /\bnow\b.*\b(write|weave|craft|answer)\b/i,
  /\bas an ai\b|\blanguage model\b|\bchatgpt\b|\bllm\b/i,
  /\bresearch backing\b|\bfact-?check(?:ed|ing)?\b.*\banswer\b/i,
]

const FENCE_PATTERN = /^```(?:\w+)?\s*|\s*```$/g
const DASH_PUNCTUATION_PATTERN = /[—–―]+|\s-\s/g
const WORD_HYPHEN_PATTERN = /(?<=\w)-(?=\w)/g

function isMetaLine(line: string): boolean {
  const normalized = line.trim()
  if (!normalized) return false
  return META_LINE_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function sanitizeStudentFacingText(text: string): string {
  return text
    .replace(DASH_PUNCTUATION_PATTERN, ', ')
    .replace(WORD_HYPHEN_PATTERN, ' ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/[ \t]+([,.!?])/g, '$1')
    .replace(/,\s*([?.!])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/**
 * Removes model/process narration from answers before they can reach students
 * or Elijah's admin textarea. The final answer should sound like Elijah
 * talking directly to a player, never like a model explaining its workflow.
 */
export function sanitizeAnswerText(text: string): string {
  const cleaned = text.replace(FENCE_PATTERN, '').trim()
  const lines = cleaned.split(/\r?\n/)

  while (lines.length > 0 && (!lines[0].trim() || isMetaLine(lines[0]) || lines[0].trim() === '---')) {
    lines.shift()
  }

  return lines
    .filter((line) => {
      if (!isMetaLine(line)) return true
      return false
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .split(/\n/)
    .map((line) => sanitizeStudentFacingText(line))
    .join('\n')
    .trim()
}
