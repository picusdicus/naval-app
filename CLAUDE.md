# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Navalcarnero Vecinal" — a Spanish-language civic web app for residents of Navalcarnero (Madrid): events agenda, a map/directory of local businesses and services, news, transit info, and an AI assistant for municipal procedures. All UI copy and code comments are in Spanish.

## Commands

```bash
npm install            # install deps
npm run dev             # dev server at http://localhost:5173 (also serves /api/chat locally, see below)
npm run build            # production build (vite build)
npm run preview          # preview the production build
npm run lint              # eslint .
npm run db:setup         # apply db/schema.sql to Neon + seed the TYL TYL test org (idempotent)
npm run fetch:comercios  # regenerate src/data/comercios.json from Google Places API
npm run fetch:eventos    # regenerate src/data/eventos-externos.json from Teatro TYL TYL API + Ayuntamiento RSS
npm run fetch:noticias   # regenerate src/data/noticias.json from Ayuntamiento press feed RSS
npm run fetch:transporte # regenerate src/data/horarios-bus.json from CRTM GTFS
```

There is no test suite in this repo. `npm run lint` is configured in package.json but there is no eslint config file at the project root (only inside `node_modules`) — running it will currently fail until a flat config (`eslint.config.js`) is added.

## Architecture

### Access control

- `src/components/AccessScreen.jsx` — password-protected login screen that blocks the entire app until the correct password is entered. Requires `VITE_APP_PASSWORD` environment variable (never hardcoded). Session is saved in localStorage under `ncv_access` key and persists across browser sessions until cleared or logout is triggered.
- Logout buttons in Header (desktop & mobile) and MenuDrawer footer clear the session and return to the access screen.

### Admin panel (`/admin`)

Separate from the resident password gate: `App.jsx` skips the `AccessScreen` check for `/admin/*`, because managers sign in with their own credentials. There is no public sign-up.

- `api/_auth.js` — issues and verifies an HS256 JWT (hand-rolled on `node:crypto`, no new dependency) carried in the `ncv_admin` **httpOnly** cookie (`SameSite=Lax`, `Secure` only in production, 8 h lifetime). Credentials are compared in constant time against `ADMIN_EMAIL` / `ADMIN_PASSWORD`. `requerirSesion(req, res)` guards private endpoints — it 401s and returns `null`, so the caller must abort.
- Endpoints: `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/sesion` (who am I), `GET /api/admin/eventos`. The org slug comes from the *signed* JWT, never from the request, so nobody can read another org's events by changing a parameter.
- Required env vars: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET` (≥32 chars; rotating it invalidates every open session). Optional: `ADMIN_NOMBRE`, `ADMIN_ORG_SLUG` (default `tyl-tyl`). None carry the `VITE_` prefix — they must never reach the browser bundle.
- Frontend: `src/lib/adminAuth.jsx` (context; the cookie is unreadable from JS, so it asks `/api/admin/sesion` on boot), `src/components/admin/RutaProtegida.jsx` (redirects to `/admin/login`, remembering the intended path), `src/pages/admin/{AdminLogin,AdminPanel}.jsx`.
- `api/admin/eventos.js` reads the org's events from the same JSON single source of truth as the public agenda, matching the `fuente` field that `scripts/fetch-eventos.mjs` writes (`'TYL TYL'`). The `eventos_usuario` Postgres table on `develop` is the eventual home for events created in-app; this branch has no DB layer.

### Frontend (Vite + React 18 + React Router + Tailwind v3)

- `src/App.jsx` — route table and access control guard; all pages render inside `src/components/layout/Layout.jsx` (Header, Footer, bottom NavBar, MenuDrawer).
- `src/pages/*` — one component per route: Inicio, Eventos, Mapa, Noticias (+ NoticiaDetalle), Transporte, Asistente.
- `src/components/directorio/` — business directory + Leaflet map (`MapaComercios.jsx`), category filters, detail card, "suggest a business" form.
- `src/components/eventos/` — event list icons/helpers.
- `src/pages/Noticias.jsx` — news list with 2-line preview of each article; clickable cards link to detail.
- `src/pages/NoticiaDetalle.jsx` — full news article detail page with date, author, full content, and link to original source on municipality website.
- `src/lib/categorias.js` — maps OSM `shop=*`/`amenity=*` tags to the app's Spanish category taxonomy; shared by the fetch script and the UI.
- `src/lib/eventos.js` — date parsing/formatting and "upcoming events" filtering, shared by the UI and the assistant's system prompt builder.
- `src/lib/cocinas.js` — cuisine/type labeling helpers for directory entries.
- Icons: `MIcon.jsx` renders Google Material Symbols (loaded via `index.html`); `components/icons.jsx` holds custom inline SVGs.

### Database (Neon Postgres)

The Neon project `navalcarnero-db` is provisioned through the Vercel Marketplace integration, so all `DATABASE_URL`/`POSTGRES_*` variables are injected into the Vercel environment automatically. For local work, run `npx vercel env pull .env.local` — `vite.config.js` forwards `DATABASE_URL` to the dev API handlers, and `scripts/db-setup.mjs` reads `.env.local` (falling back to `.env`).

- `db/schema.sql` — canonical schema. Four tables: `organizaciones` (cultural orgs), `codigos_invitacion` (invite codes an org hands out so its managers can sign up), `usuarios` (`admin`/`editor` belong to an org, `vecino` doesn't), `eventos_usuario` (events created in-app, in `borrador`/`publicado`/`archivado`). Statements are split on a trailing `;` by the setup script, so don't add functions or dollar-quoted blocks.
- `scripts/db-setup.mjs` (`npm run db:setup`) — applies the schema and seeds the test org **Teatro TYL TYL** (`slug: tyl-tyl`) with invite code **`TYLTYL-2026`** (grants `admin`, 5 uses). Idempotent via `ON CONFLICT`.
- `api/_db.js` — `obtenerSql()` returns a memoized `@neondatabase/serverless` HTTP client (tagged template). Underscore prefix keeps Vercel from deploying it as an endpoint.
- `api/health.js` — `GET /api/health` verifies the connection and that all four tables exist; returns 503 if either fails. Live at https://naval-app-one.vercel.app/api/health.

The Neon HTTP driver runs one statement per request; multi-statement SQL will not work.

### Data layer (`src/data/*.json`)

Static JSON is still the store for the read-only content below (events, news, directory, transit).

- `comercios.json` — **generated**, regenerate with `npm run fetch:comercios` (Google Places API scoped to Navalcarnero). Do not hand-edit.
- `servicios-locales.json` — hand-curated directory entries not covered by Google Places (plumbers, renovation services, etc.).
- `eventos.json` — hand-curated event agenda (municipal + neighborhood).
- `eventos-externos.json` — **generated**, regenerate with `npm run fetch:eventos` (pulls from the Teatro TYL TYL WordPress "The Events Calendar" API + Ayuntamiento cultura RSS). The UI and assistant merge this with `eventos.json`. Also updated automatically via a Vercel Cron Job (see **Automatic event sync** below).
- `noticias.json` — **generated**, regenerate with `npm run fetch:noticias` (pulls from Ayuntamiento press RSS feed at `https://navalcarnero.es/navalcarnero/prensa/feed/`). Contains title, date, summary, full content, URL, and author for each news item. Used by Noticias page and assistant's knowledge base.
- `horarios-bus.json` — **generated**, regenerate with `npm run fetch:transporte` (CRTM GTFS data). Bus line data with schedules.

### AI assistant (`api/chat.js`, `api/_knowledge.js`)

- `api/chat.js` is a Vercel serverless function (streaming) that calls the Anthropic API (`@anthropic-ai/sdk`). Model defaults to `claude-opus-4-8`, overridable via `ANTHROPIC_MODEL`. Requires `ANTHROPIC_API_KEY`.
- `api/_knowledge.js` (leading underscore = not deployed as its own endpoint) builds the system prompt: it imports the *same* JSON/lib files the frontend uses (news, events, transit, directory) plus a hardcoded list of municipal procedures (`TRAMITES`), so the assistant's knowledge stays in sync with the visible app content ("single source of truth"). The prompt instructs the model to answer only in plain-text Spanish (no Markdown) and to stick to the supplied data — no invented phone numbers, dates, or addresses.
- `vite.config.js` has a custom dev-only middleware (`devApiPlugin`) that loads `api/chat.js` via `server.ssrLoadModule` and adapts the raw Node request/response to Express/Vercel-style `req.body`/`res.json`, so the assistant works under `npm run dev` without deploying. It also copies `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` from `.env` into `process.env` for that handler.
- `vercel.json` rewrites all non-`/api/*` paths to `/index.html` (SPA routing) — API routes are handled by Vercel's function runtime directly.
- Chat history from the frontend is normalized before hitting the API (`prepararMensajes` in `api/chat.js`): must start with a `user` message, empty messages dropped, roles coerced to user/assistant.

### Automatic event sync

- `api/sync-events.js` — Vercel Cron Job endpoint that runs **daily at 07:00 UTC** to fetch and sync events from both external sources.
  - **Execution order** (ensures fresh data, no caching shortcuts):
    1. Fetch all events from external sources: TYL TYL API + Ayuntamiento RSS
    2. Combine events without duplicates and sort by date
    3. Read current `eventos-externos.json` from GitHub API
    4. Compare fetched events with the current version
    5. If changes detected, commit to GitHub via GitHub API
  - Accepts both GET (from Vercel Cron) and POST methods.
  - **Does not write to the local filesystem** — reads from GitHub API instead (avoids EROFS read-only filesystem in Vercel runtime).
  - If the fetch fails for either source, logs the error but still commits (preserves any partial updates).
  - Returns a summary: `{ timestamp, agregados, actualizados, eliminados, estadisticas, commitRealizado, errores }`.
  - Vercel detects the commit and redeploys automatically, at which point the new JSON becomes available on disk.
- Cron job is configured in `vercel.json` as `{ path: "/api/sync-events", schedule: "0 7 * * *" }`.
- Requires environment variables: `GITHUB_TOKEN` (personal access token with repo write access), `GITHUB_REPO` (e.g., "user/naval-app"), and optionally `CRON_SECRET` (for validating cron calls from Vercel).

### Design system — mid-migration

The current committed design system ("Civic Hearth", a Material 3–derived green/parchment palette) lives in `tailwind.config.js` and `src/index.css`, and is documented in `reference/*/DESIGN.md` (with accompanying `screen.png` mockups) — check those before making visual changes to match intended layout/spacing/typography. The repo is on branch `feature-new-ui` and is actively transitioning to a new "wine and gold" (vino y oro) look; some files (e.g. `src/pages/Asistente.jsx`) still reference older color-utility classes (`text-vino`, `bg-crema-dark`, etc.) that are **not** defined in the current `tailwind.config.js` — check whether a page's classes actually resolve in the current palette before assuming its styling works.
