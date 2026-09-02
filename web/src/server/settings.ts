import { createServerFn } from '@tanstack/react-start'
import type { SortMode } from '../scraper'
import {
  getSortModeImpl,
  getTargetReviewsImpl,
  setSortModeImpl,
  setTargetReviewsImpl,
} from './settings.impl'

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

export const getSortModeFn = createServerFn({ method: 'GET' }).handler(
  async () => getSortModeImpl(),
)

export const saveSortModeFn = createServerFn({ method: 'POST' })
  .validator((input: unknown): { value: SortMode } => {
    if (typeof input !== 'object' || input === null) throw new Error('Invalid input')
    const obj = input as { value?: unknown }
    const mode = obj.value
    if (mode !== 'popular' && mode !== 'newest' && mode !== 'mixed') {
      throw new Error('value must be one of: popular, newest, mixed')
    }
    return { value: mode }
  })
  .handler(async ({ data }) => setSortModeImpl(data.value))
