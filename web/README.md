# Letterboxd Review Reader

A web app that fetches and reads Letterboxd film reviews, enriched with film metadata from TMDB.

Built with [TanStack Start](https://tanstack.com/start) (SSR via Nitro's `node-server` preset), Vite, Tailwind CSS, and SQLite (Drizzle ORM + better-sqlite3).

## Requirements

- Node.js >= 20 (better-sqlite3 v13 is NAPI-based and runs on 20+, though it advertises `>= 22`)
- Docker (optional, for containerized deployment)
- A [TMDB read access token](https://www.themoviedb.org/settings/api) (optional — only needed for TMDB search)

## Environment variables

| Variable                 | Required | Default                 | Purpose                                  |
| ------------------------ | -------- | ----------------------- | ---------------------------------------- |
| `DATABASE_PATH`          | no       | `./data/letterboxd.db`  | SQLite database file location            |
| `TMDB_READ_ACCESS_TOKEN` | no       | —                       | TMDB API token, enables TMDB film search |

## Local development

```bash
npm install
npm run db:migrate   # create/update the SQLite database (drizzle-kit)
npm run dev          # dev server on http://localhost:3000
```

To change the database schema, edit `src/db/schema.ts`, then:

```bash
npm run db:generate  # generate a migration
npm run db:migrate   # apply it
```

## Production build

The build produces a self-contained Nitro Node server in `.output/`:

```bash
npm run build
node .output/server/index.mjs   # serves on $PORT (default 3000)
```

The server respects `PORT` (or `NITRO_PORT`) and `HOST` (or `NITRO_HOST`). Native dependencies (better-sqlite3, got-scraping) are traced into `.output/server/node_modules`, so no separate `node_modules` install is needed at runtime — just ship the `.output` directory (plus `drizzle/` for auto-migration).

Pending database migrations are applied automatically when the server starts (`src/db/index.ts` runs `migrate()` on boot), so there is no separate migration step for production deploys.

## Docker deployment

From the repository root (the `docker-compose.yml` lives at the repo root, next to `web/`):

```bash
docker compose up -d --build
```

- App: http://localhost:3000
- The SQLite database is stored in the named volume `letterboxd-data`, mounted at `/data` (`DATABASE_PATH=/data/letterboxd.db`), so it persists across restarts and rebuilds.
- To set the TMDB token, create a `.env` file next to `docker-compose.yml` with `TMDB_READ_ACCESS_TOKEN=...` and uncomment the line in `docker-compose.yml`.

The multi-stage `web/Dockerfile` builds with `node:20-slim` and the runtime image copies only the `.output` directory (plus the traced native modules).

## Tailscale HTTPS exposure

The simplest way to share the app over HTTPS within your tailnet, without exposing anything publicly:

```bash
sudo tailscale serve --bg 3000
# or equivalently:
sudo tailscale serve --bg http://localhost:3000
```

The app is then available at `https://<machine-name>.<tailnet>.ts.net` from any device on your tailnet (TLS certificates are provisioned automatically).

Useful commands:

```bash
tailscale serve status   # see active serve config
tailscale serve reset    # remove the serve config
```

> `--bg` persists the config across reboots; without it, serve stops when the terminal session ends.

To bind the app to localhost only (no host port exposed at all), change the compose port mapping to `"127.0.0.1:3000:3000"`. Alternatively, run a Tailscale container as a sidecar — a commented-out example is included in `docker-compose.yml`.

## Learn more

- [TanStack Start docs](https://tanstack.com/start)
- [TanStack Router](https://tanstack.com/router) (file-based routing in `src/routes`)
- [Nitro deploy docs](https://v3.nitro.build/deploy)
- [Drizzle ORM](https://orm.drizzle.team)
