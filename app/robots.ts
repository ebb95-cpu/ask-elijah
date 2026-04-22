import type { MetadataRoute } from 'next'

/**
 * robots.txt — lets all crawlers index everything public, points them
 * at the sitemap, and disallows the admin + API surface so Google
 * doesn't waste crawl budget on auth-gated and functional routes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/approve', '/track', '/history', '/profile'],
      },
    ],
    sitemap: 'https://elijahbryant.pro/sitemap.xml',
  }
}
