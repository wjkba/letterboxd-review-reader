import { createServerFn } from '@tanstack/react-start'
import { getTargetReviewsImpl, setTargetReviewsImpl } from './settings.impl'

export const getTargetReviewsFn = createServerFn({ method: 'GET' }).handler(
  async () => getTargetReviewsImpl(),
)

export const saveTargetReviewsFn = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (typeof input !== 'object' || input === null) throw new Error('Invalid input')
    const obj = input as { value?: unknown }
    if (typeof obj.value !== 'number' || !Number.isInteger(obj.value)) {
      throw new Error('value required (integer)')
    }
    if (obj.value < 1 || obj.value > 100) {
      throw new Error('value must be between 1 and 100')
    }
    return { value: obj.value }
  })
  .handler(async ({ data }) => setTargetReviewsImpl(data.value))
