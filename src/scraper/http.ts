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

function assertNotChallenge(
  statusCode: number,
  body: string,
  headers: Record<string, unknown>,
  url: string
): void {
  if (isChallengeResponse(statusCode, body, headers)) {
    throw new CloudflareChallengeError(url)
  }
}

export async function getHTML(url: string): Promise<string> {
  const response = await gotScraping({
    url,
    headerGeneratorOptions,
    timeout: { request: 30_000 },
    retry: { limit: 3, methods: ['GET'] },
  })
  assertNotChallenge(response.statusCode, response.body, response.headers, url)
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
  assertNotChallenge(response.statusCode, response.body, response.headers, url)
  return { body: response.body, finalUrl: response.url }
}
