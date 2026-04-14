# Ask Elijah

A basketball mental performance Q&A app where young players submit one question and get a personal answer from NBA/EuroLeague Champion Elijah Bryant.

Built with Next.js 14, Supabase, Anthropic Claude, Pinecone, Resend, and Vercel.

---

## How It Works

### Player Flow
1. Player lands on the homepage (`elijahbryant.pro`) and clicks Ask
2. They type their question on `/ask`
3. They enter their email (age confirmation required)
4. While Claude generates a draft answer using RAG from Elijah's knowledge base, the player completes a short profile (name, position, level, challenge)
5. They see "Here's a first take" with the AI draft — clearly marked as pending Elijah's review
6. A confirmation email lands in their inbox
7. Elijah reviews, edits, and approves the answer from the admin panel or the `/approve/[id]` page
8. The final answer is emailed to the player
9. 48 hours later, an accountability follow-up email asks if they acted on it

### Elijah's Flow (Admin)
1. New questions appear in the admin panel at `/admin/questions`
2. Each card shows the question, a Claude-generated draft, and relevant knowledge base sources
3. Elijah can edit the draft directly, add his own thoughts ("Add & Remix"), or skip
4. Click **Approve & Send** — the final answer emails to the player and gets embedded into Pinecone to improve future answers
5. Daily Reddit research runs automatically, surfaces relevant questions from basketball communities, and adds them to the queue as practice content

---

## Features

### For Players
- **Single question format** — one question, one personal answer
- **Draft preview** — see a first take immediately while Elijah reviews
- **Player profile** — position, level, country, challenge area used to personalize answers
- **Question history** — `/history` shows all past questions and answers
- **Community feed** — `/browse` shows top-voted answered questions
- **Upvoting** — players can vote on questions they relate to
- **Multi-language support** — questions detected and answered in the player's language
- **Memory system** — Claude remembers key facts about each player across sessions

### For Elijah (Admin)
- **Question queue** — pending questions sorted by type (real players first, Reddit research second)
- **Add & Remix** — type raw thoughts, Claude rewrites them into Elijah's voice using the Hormozi/Nir Eyal framework
- **Dashboard stats** — total players, questions this week, answer rate, avg response time, waitlist count
- **Clickable stat cards** — click any stat to drill into the relevant view
- **Waitlist management** — approve/unapprove confirmed waitlist entries, one-click notify
- **Run Research** — manually trigger the Reddit scraper from the admin panel
- **Toast notifications** — confirms when an email has been sent

### Beta & Waitlist
- **Beta cap** — controlled by `BETA_CAP` env var (default: 30 unique emails)
- **Waitlist form** — when cap is hit, players see a waitlist form (name, email, challenge)
- **Double opt-in** — confirmation email with a token link before they're added
- **Admin approval** — each waitlist entry can be individually approved before notifying
- **Notify batch** — one button emails all approved+confirmed+un-notified entries

### Email System (Resend)
All emails follow Elijah's brand standard: black background, bold two-tone headline, gray text CTA, signature with slogan.

| Email | Trigger |
|-------|---------|
| Question confirmation | Player submits a question |
| Waitlist confirmation | Player joins waitlist (double opt-in link) |
| Waitlist access | Elijah notifies waitlist manually |
| Answer delivery | Elijah approves a question |
| 48hr accountability | Cron job — follows up after answer sent |
| Weekly recap | Cron job — Sunday summary of the week's answers |
| Profile nudge | Cron job — reminds players who haven't completed their profile |
| Daily research summary | Cron job — tells Elijah how many new questions came in |

### AI & Knowledge Base
- **RAG pipeline** — questions are embedded with Voyage AI, matched against Pinecone, and answered using relevant content from Elijah's YouTube videos and newsletters
- **Answer structure** — Pain → Mechanism → Solution → Investment (Hormozi framework)
- **Voice rules** — strict system prompt enforces Elijah's voice (no em dashes, no bullet points, no AI-sounding words)
- **VERIFY flags** — Claude marks uncertain science claims for Elijah to review before sending
- **Topic + trigger tagging** — each question is tagged (confidence, pressure, slump, etc.) for analytics
- **Memory extraction** — key facts extracted from each question and stored per player

### Analytics
- **PostHog** — funnel tracking: question drafted → email gate shown → email submitted → question sent → question confirmed
- **Admin excluded** — PostHog does not track `/admin/*` routes

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js 14 App Router (TypeScript) |
| Database | Supabase (PostgreSQL) |
| Auth (admin) | Cookie-based password gate |
| AI | Anthropic Claude (claude-haiku-4-5) |
| Embeddings | Voyage AI (voyage-3-lite) |
| Vector DB | Pinecone |
| Email | Resend |
| Newsletter | Beehiiv |
| Analytics | PostHog |
| Rate limiting | Upstash Redis |
| Deployment | Vercel |

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
VOYAGE_API_KEY
PINECONE_API_KEY
PINECONE_HOST
RESEND_API_KEY
CRON_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
NEXT_PUBLIC_SITE_URL
BEEHIIV_API_KEY
BEEHIIV_PUBLICATION_ID
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
BETA_CAP
```

---

## Cron Jobs (Vercel)

| Job | Schedule | What it does |
|-----|----------|-------------|
| `/api/cron/daily-research` | Daily | Scrapes Reddit basketball communities, filters questions with Claude, generates draft answers |
| `/api/cron/accountability` | 48hrs after answer | Follow-up email asking if the player acted on the advice |
| `/api/cron/recap` | Weekly (Sunday) | Sends Elijah a summary of the week's answered questions |
| `/api/cron/profile-nudge` | Weekly | Nudges players who haven't completed their profile |

---

## Local Development

```bash
npm install
npm run dev
```

Requires a `.env.local` file with the variables above. Upstash Redis is optional locally — rate limiting fails open if not configured.

---

## Deployment

Push to `main` — Vercel auto-deploys. All env vars are configured in the Vercel dashboard.
