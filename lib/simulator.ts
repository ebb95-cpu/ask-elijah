/**
 * Simulator-mode detection + fetch short-circuit helpers.
 *
 * Any page rendered inside the /admin/simulate iframe should behave as a
 * pretend environment: real endpoints that mutate state (submitting a
 * question, paying through Stripe, saving a profile, upvoting) must NOT
 * actually fire. Read endpoints (browse, my-questions, journal) can go
 * through normally — they only return existing data.
 *
 * Usage:
 *   import { isInSimulator, simFetch } from '@/lib/simulator'
 *   const res = await simFetch('/api/ask', { method: 'POST', body: ... }, { ok: true })
 *
 * In non-simulator contexts simFetch just forwards to the real fetch. In
 * simulator contexts it resolves immediately with a canned Response built
 * from the mock body, after a short delay so loading states still flash
 * visibly.
 */

/**
 * True when the current page is rendered inside a same-origin iframe whose
 * top-level parent is /admin/simulate. Checked defensively: we only treat
 * it as simulator mode if we can confirm the parent origin matches ours.
 * Anything else (cross-origin embed, top-level frame, SSR) returns false.
 */
export function isInSimulator(): boolean {
  if (typeof window === 'undefined') return false
  if (window.self === window.top) return false
  try {
    const parentPath = window.parent.location.pathname
    return parentPath.startsWith('/admin/simulate')
  } catch {
    return false
  }
}

/**
 * Fetch wrapper: bypasses the network in simulator mode and resolves with a
 * mock Response instead. Non-simulator context is a plain passthrough.
 *
 * @param input   Same as fetch's first arg
 * @param init    Same as fetch's second arg
 * @param mock    Body to return in simulator mode (JSON-serializable)
 * @param delayMs Simulated latency so the UI's loading state is still visible
 */
export async function simFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  mock: unknown,
  delayMs = 600
): Promise<Response> {
  if (!isInSimulator()) return fetch(input, init)

  await new Promise((r) => setTimeout(r, delayMs))
  const body = JSON.stringify(mock)
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
