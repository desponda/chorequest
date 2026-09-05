import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/display', '/parent', '/kid/', '/join/'],
    },
    sitemap: 'https://chorequest.dresponda.com/sitemap.xml',
  }
}
