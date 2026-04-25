export type AnswerSource = { title: string; url: string; type?: string | null }

export function getSourceType(source: AnswerSource) {
  const type = (source.type || '').toLowerCase()
  const url = source.url.toLowerCase()
  if (type.includes('youtube') || url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (type.includes('newsletter')) return 'newsletter'
  if (type.includes('drive') || type.includes('pdf') || url.includes('drive.google.com')) return 'guide'
  if (type.includes('web')) return 'web'
  return 'resource'
}

export function getSourceIcon(source: AnswerSource) {
  const type = getSourceType(source)
  if (type === 'newsletter') return '✉'
  if (type === 'guide') return '↓'
  if (type === 'web') return '↗'
  return '▶'
}

export function getSourceAction(source: AnswerSource) {
  const type = getSourceType(source)
  if (type === 'youtube') return 'Watch'
  if (type === 'newsletter') return 'Read'
  if (type === 'guide') return 'Download'
  if (type === 'web') return 'Source'
  return 'Open'
}

export function getAdminSourceCta(source: AnswerSource) {
  const type = getSourceType(source)
  if (type === 'youtube') return 'Watch Elijah explain this'
  if (type === 'newsletter') return 'Read the newsletter'
  if (type === 'guide') return 'Download the guide'
  if (type === 'web') return 'Source checked'
  return 'Related resource'
}
