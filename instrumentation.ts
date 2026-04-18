/**
 * Next.js instrumentation hook. Fires once when the server starts. We use
 * it to load the Sentry init file appropriate for whichever runtime we're
 * in (Node.js for /api routes, Edge for middleware). The client config
 * runs separately via sentry.client.config.ts.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs'
