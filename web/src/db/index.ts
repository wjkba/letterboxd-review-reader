import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from './schema'

const DB_PATH = process.env.DATABASE_PATH || './data/letterboxd.db'

mkdirSync(dirname(DB_PATH), { recursive: true })

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export type DB = typeof db
export { schema }

// Apply pending migrations on startup (idempotent). Keeps production/Docker
// boots working without a separate migration step; migrations live in
// ./drizzle (relative to the working directory — /app in the Docker image).
migrate(db, { migrationsFolder: './drizzle' })
