import { gotScraping } from 'got-scraping'

export const BASE_URL = 'https://letterboxd.com'

export const headerGeneratorOptions = {
  browsers: [{ name: 'chrome', minVersion: 120 }],
  devices: ['desktop'],
  operatingSystems: ['macos'],
} as const

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getHTML(url: string): Promise<string> {
  const response = await gotScraping({
    url,
    headerGeneratorOptions,
    timeout: { request: 30_000 },
    retry: { limit: 3, methods: ['GET'] },
  })
  return response.body
}

/**
 * Same fetch options as `getHTML`, but follows redirects and reports the
 * final URL — used to resolve `letterboxd.com/tmdb/{id}` pages to their
 * canonical film slug.
 */
export async function getHTMLWithRedirect(
  url: string
): Promise<{ body: string; finalUrl: string }> {
  const response = await gotScraping({
    url,
    headerGeneratorOptions,
    timeout: { request: 30_000 },
    retry: { limit: 3, methods: ['GET'] },
    followRedirect: true,
  })
  return { body: response.body, finalUrl: response.url }
}
