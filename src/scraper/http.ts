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

/**
 * Thrown when Cloudflare serves a bot-challenge page instead of the
 * requested document. Callers must abort rather than store the challenge
 * markup (a full HTML document) as content.
 */
export class CloudflareChallengeError extends Error {
  readonly url: string

  constructor(url: string) {
    super(`Cloudflare challenge page served for ${url}`)
    this.name = 'CloudflareChallengeError'
    this.url = url
  }
}

/** Status codes Cloudflare uses when serving a challenge page. */
const CHALLENGE_STATUS_CODES = new Set([403, 429, 503])

/**
 * Heuristic check for Cloudflare challenge responses. The `cf-mitigated`
 * header and an embedded `cf_chl_opt` script variable are definitive; the
 * "Just a moment…" marker alone is not trusted — it only counts alongside a
 * challenge status code, so a normal 200 Letterboxd page never trips it.
 */
function isChallengeResponse(
  statusCode: number,
  body: string,
  headers: Record<string, unknown>
): boolean {
  const mitigated = headers['cf-mitigated']
  if (typeof mitigated === 'string' && mitigated.includes('challenge')) {
    return true
  }
  if (/cf_chl_opt/.test(body)) return true
  return CHALLENGE_STATUS_CODES.has(statusCode) && /Just a moment/.test(body)
}

/** Backoff waits between challenge-response retries: 5s, then 15s. */
const CHALLENGE_RETRY_DELAYS_MS = [5_000, 15_000] as const

/**
 * Run `fetch` and, on a Cloudflare challenge response, retry with the
 * increasing backoff above before giving up — challenges are often
 * transient, so a hard abort on the first hit aborts scrapes
 * unnecessarily. Total worst-case added latency per url is bounded
 * (~20s). Only once the retries are exhausted is `CloudflareChallengeError`
 * thrown.
 */
async function fetchWithChallengeRetry<
  T extends { statusCode: number; body: string; headers: Record<string, unknown> },
>(url: string, fetch: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch()
    if (
      !isChallengeResponse(response.statusCode, response.body, response.headers)
    ) {
      return response
    }
    if (attempt >= CHALLENGE_RETRY_DELAYS_MS.length) {
      throw new CloudflareChallengeError(url)
    }
    await delay(CHALLENGE_RETRY_DELAYS_MS[attempt])
  }
}

export async function getHTML(url: string): Promise<string> {
  const response = await fetchWithChallengeRetry(url, () =>
    gotScraping({
      url,
      headerGeneratorOptions,
      timeout: { request: 30_000 },
      retry: { limit: 3, methods: ['GET'] },
    })
  )
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
  const response = await fetchWithChallengeRetry(url, () =>
    gotScraping({
      url,
      headerGeneratorOptions,
      timeout: { request: 30_000 },
      retry: { limit: 3, methods: ['GET'] },
      followRedirect: true,
    })
  )
  return { body: response.body, finalUrl: response.url }
}
