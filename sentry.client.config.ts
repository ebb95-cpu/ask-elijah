/**
 * Sentry client-side (browser) initialization.
 *
 * Captures unhandled JS errors, promise rejections, and route transitions
 * from the browser and forwards them to the askelijah Sentry project.
 * Runs on every page load — Next.js wires this in automatically via the
 * @sentry/nextjs webpack plugin configured in next.config.mjs.
 *
 * The DSN is baked into the bundle at build time via NEXT_PUBLIC_SENTRY_DSN.
 * That's safe — DSNs are write-only keys that can only SEND events, not
 * read them.
 */

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Sample rates. tracesSampleRate controls performance spans (keep low to
  // avoid blowing the free quota); replaysSessionSampleRate is off by default.
  tracesSampleRate: 0.1,
  // Only capture session replay on error — no quota spent on happy-path sessions.
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
  // Don't report in dev — saves noise in your Sentry dashboard while building.
  enabled: process.env.NODE_ENV === 'production',
  // The Next.js integration detects the environment automatically; these
  // help filter issues in the Sentry UI.
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
})
