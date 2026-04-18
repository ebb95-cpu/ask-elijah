import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse'],
}

// Wrap the config with Sentry's webpack plugin so the build uploads source
// maps to Sentry (enabling readable stack traces on production errors).
// SENTRY_AUTH_TOKEN is only read at build time — never shipped to the client.
export default withSentryConfig(nextConfig, {
  org: 'askelijah',
  project: 'ask-elijah-web',
  // Silent in local dev; noisy on Vercel where logs are useful.
  silent: !process.env.CI,
  // Source map upload runs only when the token is set (i.e. on Vercel).
  // Missing token = build skips upload with a warning, which is fine for
  // preview environments where we haven't provisioned the token.
  disableLogger: true,
  // Tunnel through a Next.js rewrite so ad blockers don't stop client
  // events from reaching Sentry. Small perf cost, big reliability win.
  tunnelRoute: '/monitoring',
})
