/**
 * Client-facing API types.
 *
 * UI components and routes must import data types from here — never from
 * `#/db/schema` directly. This keeps the database layer a server-side
 * implementation detail and gives us one boundary to evolve if the API
 * shape ever diverges from the DB schema.
 */
export type { Film, Review } from '../db/schema'
