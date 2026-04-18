/**
 * Sentry server-side (Node) initialization. Catches unhandled errors in
 * /api routes, Server Components, and middleware. Separate init from the
 * client because the server runtime is isolated.
 */

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
})
