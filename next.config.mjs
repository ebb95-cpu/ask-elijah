import { withSentryConfig } from '@sentry/nextjs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: appRoot,
  serverExternalPackages: ['pdf-parse'],
  async headers() {
    // Baseline security headers applied to every response. Kept conservative:
    // we don't ship a CSP here because we'd need to audit PostHog / Sentry /
    // Supabase / Stripe script/connect sources first, and a wrong CSP silently
    // breaks the app. Add it in a follow-up once we know the full origin list.
    const security = [
      // Force HTTPS for two years including subdomains. Once this ships you
      // cannot browse the naked domain over HTTP.
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      // Don't let browsers sniff MIME types — blocks a class of XSS via
      // mis-typed uploads.
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Clickjacking: we never want this site framed.
      { key: 'X-Frame-Options', value: 'DENY' },
      // Don't leak the path of the page the user came from to third parties.
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Turn off every powerful browser API by default. Opt back in only if
      // we actually use one (we don't today).
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()',
      },
    ]
    return [{ source: '/:path*', headers: security }]
  },
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
