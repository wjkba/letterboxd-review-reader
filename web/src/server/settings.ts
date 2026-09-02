import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  getSortModeImpl,
  getTargetReviewsImpl,
  setSortModeImpl,
  setTargetReviewsImpl,
} from './settings.impl'

export const getTargetReviewsFn = createServerFn({ method: 'GET' }).handler(
  async () => getTargetReviewsImpl(),
)

const targetReviewsInput = z.object({
  value: z
    .number('value required (integer)')
    .int('value required (integer)')
    .min(1, 'value must be between 1 and 100')
    .max(100, 'value must be between 1 and 100'),
})

export const saveTargetReviewsFn = createServerFn({ method: 'POST' })
  .validator(targetReviewsInput)
  .handler(async ({ data }) => setTargetReviewsImpl(data.value))

export const getSortModeFn = createServerFn({ method: 'GET' }).handler(
  async () => getSortModeImpl(),
)

const sortModeInput = z.object({
  value: z.enum(['popular', 'newest', 'mixed'], {
    message: 'value must be one of: popular, newest, mixed',
  }),
})

export const saveSortModeFn = createServerFn({ method: 'POST' })
  .validator(sortModeInput)
  .handler(async ({ data }) => setSortModeImpl(data.value))
