import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { likeReviewImpl } from './likes.impl'

export type { LikeReviewResult } from './likes.impl'

const likeReviewInput = z.object({
  reviewId: z.number('reviewId required (number)').int().positive(),
  liked: z.boolean('liked required (boolean)'),
})

export const likeReviewFn = createServerFn({ method: 'POST' })
  .validator(likeReviewInput)
  .handler(async ({ data }) => likeReviewImpl(data.reviewId, data.liked))
