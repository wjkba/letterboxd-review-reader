import { createServerFn } from '@tanstack/react-start'
import { getScrapeLogsImpl } from './scrape-logs.impl'

export const getScrapeLogsFn = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null) {
      return { slug: '' } as { slug: string }
    }
    const obj = input as { slug?: unknown }
    const slug = typeof obj.slug === 'string' ? obj.slug.trim().toLowerCase() : ''
    if (!slug) throw new Error('slug required (string)')
    return { slug }
  })
  .handler(async ({ data }) => getScrapeLogsImpl(data.slug))
