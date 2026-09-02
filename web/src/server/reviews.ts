import { createServerFn } from '@tanstack/react-start'
import { getReviewsImpl } from './reviews.impl'

export const getReviewsFn = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null) {
      return { slug: '', limit: 100 } as { slug: string; limit: number }
    }
    const obj = input as { slug?: unknown; limit?: unknown }
    const slug = typeof obj.slug === 'string' ? obj.slug.trim().toLowerCase() : ''
    const limit =
      typeof obj.limit === 'number' && obj.limit > 0 ? Math.min(obj.limit, 500) : 100
    if (!slug) throw new Error('slug required (string)')
    return { slug, limit }
  })
  .handler(async ({ data }) => getReviewsImpl(data.slug, data.limit))
