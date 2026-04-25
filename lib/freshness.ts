export type FreshnessTopic =
  | 'nil_ncaa'
  | 'eligibility'
  | 'recruiting'
  | 'transfer_portal'
  | 'scholarships'
  | 'rules'
  | 'medical'
  | 'products'
  | 'current_events'

type TopicRule = {
  topic: FreshnessTopic
  label: string
  pattern: RegExp
  preferredSources: string
}

const TOPIC_RULES: TopicRule[] = [
  {
    topic: 'nil_ncaa',
    label: 'NIL / NCAA',
    pattern: /\b(nil|name image likeness|ncaa|naia|njcaa|college eligibility|college compliance|compliance office)\b/i,
    preferredSources: 'official NCAA pages, school compliance pages, state law summaries, and dated legal/compliance sources',
  },
  {
    topic: 'transfer_portal',
    label: 'transfer portal',
    pattern: /\b(transfer portal|portal|transfer rule|redshirt|sit out|waiver)\b/i,
    preferredSources: 'official NCAA pages, conference or school compliance pages, and dated reporting from credible sports-law sources',
  },
  {
    topic: 'eligibility',
    label: 'eligibility',
    pattern: /\b(eligib|amateurism|clearinghouse|certification|core course|gpa requirement|academic requirement)\b/i,
    preferredSources: 'official NCAA Eligibility Center pages, school compliance pages, and dated official guidance',
  },
  {
    topic: 'recruiting',
    label: 'recruiting',
    pattern: /\b(recruit|offer|coach can contact|dead period|quiet period|visit|official visit|unofficial visit)\b/i,
    preferredSources: 'official NCAA recruiting calendars, school compliance pages, and current recruiting guidance',
  },
  {
    topic: 'scholarships',
    label: 'scholarships',
    pattern: /\b(scholarship|roster limit|rev share|revenue share|revenue sharing|house settlement|collective)\b/i,
    preferredSources: 'official NCAA, school, conference, and dated sports-law or compliance sources',
  },
  {
    topic: 'rules',
    label: 'rules',
    pattern: /\b(rule change|new rule|shot clock|fiba|high school rule|aau rule|travel rule|eligibility rule|bylaw)\b/i,
    preferredSources: 'official rulebooks, governing-body pages, and dated rule-change announcements',
  },
  {
    topic: 'medical',
    label: 'medical / injury',
    pattern: /\b(injury|injured|concussion|acl|mcl|meniscus|ankle sprain|pain in my|doctor|physical therapy|rehab|supplement|creatine|medicine|medication)\b/i,
    preferredSources: 'medical organizations, clinical guidance, and current peer-reviewed or hospital sources',
  },
  {
    topic: 'products',
    label: 'products / gear',
    pattern: /\b(best shoes|shoe should i|basketball shoes|ankle brace|knee sleeve|wearable|app|training program|price|cost|buy)\b/i,
    preferredSources: 'current product pages, manufacturer specs, and recent reputable reviews',
  },
  {
    topic: 'current_events',
    label: 'current events',
    pattern: /\b(today|this week|this season|latest|current|new|recent|2025|2026|news|rankings|schedule|scores)\b/i,
    preferredSources: 'dated primary sources and recent reputable reporting',
  },
]

export function detectFreshnessTopics(text: string): TopicRule[] {
  const unique = new Map<FreshnessTopic, TopicRule>()
  for (const rule of TOPIC_RULES) {
    if (rule.pattern.test(text)) unique.set(rule.topic, rule)
  }
  return Array.from(unique.values())
}

export function getFreshnessInstruction(text: string) {
  const topics = detectFreshnessTopics(text)
  if (topics.length === 0) return ''

  const labels = topics.map((t) => t.label).join(', ')
  const preferred = Array.from(new Set(topics.map((t) => t.preferredSources))).join('; ')

  return `\n\nFAST-CHANGING TOPIC CHECK: This question appears to involve ${labels}. Do not rely only on the knowledge base or model memory. Use web_search/web_fetch before giving any factual, legal, rules, eligibility, medical, product, price, schedule, roster, or current-events claim. Prefer ${preferred}. If the topic could affect eligibility, money, health, legal rights, school compliance, or recruiting, say clearly that the player should verify with their school/compliance office, doctor, trainer, or appropriate professional before acting. Keep that caveat short and human. Capture sources separately. Do not put URLs in the answer body.`
}

export function requiresFreshWeb(text: string) {
  return detectFreshnessTopics(text).length > 0
}
