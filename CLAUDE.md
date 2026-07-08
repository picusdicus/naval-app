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
npm run fetch:comercios  # regenerate src/data/comercios.json from OpenStreetMap
npm run fetch:eventos    # regenerate src/data/eventos-externos.json from the Teatro TYL TYL API
```

There is no test suite in this repo. `npm run lint` is configured in package.json but there is no eslint config file at the project root (only inside `node_modules`) — running it will currently fail until a flat config (`eslint.config.js`) is added.

## Architecture

### Frontend (Vite + React 18 + React Router + Tailwind v3)

- `src/App.jsx` — route table; all pages render inside `src/components/layout/Layout.jsx` (Header, Footer, bottom NavBar, MenuDrawer).
- `src/pages/*` — one component per route: Inicio, Eventos, Mapa, Noticias, Transporte, Asistente.
- `src/components/directorio/` — business directory + Leaflet map (`MapaComercios.jsx`), category filters, detail card, "suggest a business" form.
- `src/components/eventos/` — event list icons/helpers.
- `src/lib/categorias.js` — maps OSM `shop=*`/`amenity=*` tags to the app's Spanish category taxonomy; shared by the fetch script and the UI.
- `src/lib/eventos.js` — date parsing/formatting and "upcoming events" filtering, shared by the UI and the assistant's system prompt builder.
- `src/lib/cocinas.js` — cuisine/type labeling helpers for directory entries.
- Icons: `MIcon.jsx` renders Google Material Symbols (loaded via `index.html`); `components/icons.jsx` holds custom inline SVGs.

### Data layer (`src/data/*.json`)

Static JSON is the only data store — no backend database.

- `comercios.json` — **generated**, regenerate with `npm run fetch:comercios` (Overpass/OpenStreetMap query scoped to the Navalcarnero administrative boundary). Do not hand-edit.
- `servicios-locales.json` — hand-curated directory entries not covered by OSM (plumbers, renovation services, etc.).
- `eventos.json` — hand-curated event agenda (municipal + neighborhood).
- `eventos-externos.json` — **generated**, regenerate with `npm run fetch:eventos` (pulls from the Teatro TYL TYL WordPress "The Events Calendar" API). The UI and assistant merge this with `eventos.json`.
- `transporte.json` — bus line data.

### AI assistant (`api/chat.js`, `api/_knowledge.js`)

- `api/chat.js` is a Vercel serverless function (streaming) that calls the Anthropic API (`@anthropic-ai/sdk`). Model defaults to `claude-opus-4-8`, overridable via `ANTHROPIC_MODEL`. Requires `ANTHROPIC_API_KEY`.
- `api/_knowledge.js` (leading underscore = not deployed as its own endpoint) builds the system prompt: it imports the *same* JSON/lib files the frontend uses (events, transit, directory) plus a hardcoded list of municipal procedures (`TRAMITES`), so the assistant's knowledge stays in sync with the visible app content ("single source of truth"). The prompt instructs the model to answer only in plain-text Spanish (no Markdown) and to stick to the supplied data — no invented phone numbers, dates, or addresses.
- `vite.config.js` has a custom dev-only middleware (`devApiPlugin`) that loads `api/chat.js` via `server.ssrLoadModule` and adapts the raw Node request/response to Express/Vercel-style `req.body`/`res.json`, so the assistant works under `npm run dev` without deploying. It also copies `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` from `.env` into `process.env` for that handler.
- `vercel.json` rewrites all non-`/api/*` paths to `/index.html` (SPA routing) — API routes are handled by Vercel's function runtime directly.
- Chat history from the frontend is normalized before hitting the API (`prepararMensajes` in `api/chat.js`): must start with a `user` message, empty messages dropped, roles coerced to user/assistant.

### Design system — mid-migration

The current committed design system ("Civic Hearth", a Material 3–derived green/parchment palette) lives in `tailwind.config.js` and `src/index.css`, and is documented in `reference/*/DESIGN.md` (with accompanying `screen.png` mockups) — check those before making visual changes to match intended layout/spacing/typography. The repo is on branch `feature-new-ui` and is actively transitioning to a new "wine and gold" (vino y oro) look; some files (e.g. `src/pages/Asistente.jsx`) still reference older color-utility classes (`text-vino`, `bg-crema-dark`, etc.) that are **not** defined in the current `tailwind.config.js` — check whether a page's classes actually resolve in the current palette before assuming its styling works.
