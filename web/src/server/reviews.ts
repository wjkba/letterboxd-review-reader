import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getReviewsImpl } from './reviews.impl'

const reviewsInput = z.object({
  slug: z
    .string('slug required (string)')
    .trim()
    .toLowerCase()
    .min(1, 'slug required (string)'),
  // Clamp to 1..500 reviews, default 100.
  limit: z.number().int().positive().max(500).default(100),
})

export const getReviewsFn = createServerFn({ method: 'GET' })
  .validator(reviewsInput)
  .handler(async ({ data }) => getReviewsImpl(data.slug, data.limit))
