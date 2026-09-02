import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const films = sqliteTable('films', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  year: integer('year'),
  posterPath: text('poster_path'),
  tmdbId: integer('tmdb_id'),
  scrapeStatus: text('scrape_status').notNull().default('pending'),
  scrapeError: text('scrape_error'),
  lastScrapedAt: integer('last_scraped_at'),
  reviewCount: integer('review_count').notNull().default(0),
  addedAt: integer('added_at')
    .notNull()
    .$defaultFn(() => Date.now()),
})

export const reviews = sqliteTable(
  'reviews',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    filmId: integer('film_id')
      .notNull()
      .references(() => films.id, { onDelete: 'cascade' }),
    author: text('author').notNull(),
    authorUrl: text('author_url'),
    rating: integer('rating'),
    watchedDate: text('watched_date'),
    reviewUrl: text('review_url').notNull(),
    html: text('html').notNull(),
    scrapedAt: integer('scraped_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (table) => [uniqueIndex('reviews_film_url_idx').on(table.filmId, table.reviewUrl)],
)

export const scrapeJobs = sqliteTable('scrape_jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filmId: integer('film_id')
    .notNull()
    .references(() => films.id, { onDelete: 'cascade' }),
  startedAt: integer('started_at')
    .notNull()
    .$defaultFn(() => Date.now()),
  finishedAt: integer('finished_at'),
  status: text('status').notNull(),
  pagesScraped: integer('pages_scraped').notNull().default(0),
  reviewsAdded: integer('reviews_added').notNull().default(0),
  error: text('error'),
})

export type Film = typeof films.$inferSelect
export type NewFilm = typeof films.$inferInsert
export type Review = typeof reviews.$inferSelect
export type NewReview = typeof reviews.$inferInsert
export type ScrapeJob = typeof scrapeJobs.$inferSelect
export type NewScrapeJob = typeof scrapeJobs.$inferInsert
