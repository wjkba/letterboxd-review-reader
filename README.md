# Letterboxd Review Reader

A self-hosted, e-ink style reader for long-form Letterboxd film reviews. Add a film, and the app scrapes its popular or newest reviews in the background and presents them on a clean, paper-like reading surface — designed to run on e-reader devices like Onyx Boox.

## ✨ Features

- Scrapes popular or newest Letterboxd reviews in the background, with live progress
- E-ink style reading interface — grayscale, serif, paper-like
- Read progress tracking per film, picks up where you left off
- Like reviews on Letterboxd directly from the app (optional)
- Review settings: sort order and target number of reviews per film
- Film management: rescrape, mark read/unread, delete
- Language-filtered reviews

## 🛠️ Tech Stack

- [TanStack Start](https://tanstack.com/start) (SSR via Nitro's `node-server` preset) + Vite
- [TanStack Router](https://tanstack.com/router) — file-based routing in `src/routes`
- Tailwind CSS
- [Drizzle ORM](https://orm.drizzle.team) + better-sqlite3 (SQLite)
- Cheerio + got-scraping for Letterboxd review parsing
- pnpm 11

## 🚀 Getting Started

Requires Node.js >= 20 and pnpm 11. To skip local setup entirely, use Docker (see below).

### Install

```bash
pnpm install
```

### Configure

Environment variables are optional and read at runtime:

| Variable                 | Required | Default                | Purpose                                                                   |
| ------------------------ | -------- | ---------------------- | ------------------------------------------------------------------------- |
| `DATABASE_PATH`          | no       | `./data/letterboxd.db` | SQLite database file location                                             |
| `TMDB_READ_ACCESS_TOKEN` | no       | —                      | TMDB API token, enables film title search                                 |
| `LETTERBOXD_COOKIE`      | no       | —                      | Your Letterboxd session cookie, enables liking reviews from the app       |
| `LETTERBOXD_USER_AGENT`  | no       | —                      | Must match the browser UA the cookie was captured from (Cloudflare binds clearance to UA) |

The cookie is server-side only and is never sent to the client.

### Run

```bash
pnpm run db:migrate   # create/update the SQLite database (drizzle-kit)
pnpm run dev          # dev server on http://localhost:3000
```

To change the database schema, edit `src/db/schema.ts`, then:

```bash
pnpm run db:generate  # generate a migration
pnpm run db:migrate   # apply it
```

## 🏗️ Production build

The build produces a self-contained Nitro Node server in `.output/` — ship that directory and run it, no separate `node_modules` needed:

```bash
pnpm run build
node .output/server/index.mjs   # serves on $PORT (default 3000)
```

`PORT`/`HOST` are respected, and pending database migrations are applied automatically on server start.

## 🐳 Docker deployment

```bash
docker compose up -d --build
```

- App: http://localhost:3000
- The SQLite database persists in the named volume `letterboxd-data`, mounted at `/data`.
- To set the TMDB token or Letterboxd cookie, create a `.env` file next to `docker-compose.yml` and uncomment the corresponding lines.

## 🔒 Tailscale HTTPS exposure

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

## Contributing

Issues and pull requests are welcome!

## Learn more

- [TanStack Start docs](https://tanstack.com/start)
- [TanStack Router](https://tanstack.com/router) (file-based routing in `src/routes`)
- [Nitro deploy docs](https://v3.nitro.build/deploy)
- [Drizzle ORM](https://orm.drizzle.team)
