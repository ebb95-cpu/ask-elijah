import { getSupabase } from './supabase-server'

/**
 * Log a non-fatal error to Supabase `error_log` so we can see what's breaking.
 * Always resolves — never throws. Safe to use inside `.catch()`.
 */
export async function logError(
  source: string,
  err: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : JSON.stringify(err)

  // Always also hit the console so it's visible in Vercel logs
  console.error(`[${source}]`, message, context ?? '')

  try {
    const supabase = getSupabase()
    await supabase.from('error_log').insert({
      source,
      message: message.slice(0, 2000),
      context: context ?? null,
    })
  } catch (logErr) {
    // If even logging fails, just warn — do not throw
    console.warn(`[log-error:failed] ${source}:`, logErr)
  }
}
