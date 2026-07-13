/**
 * api/analytics/umami-stats.js
 *
 * Vercel edge function — proxies the Umami Analytics API to the admin panel.
 * Umami v3.2.0 has no API Keys: we log in with username/password to obtain a
 * JWT and send it as a Bearer token. Credentials stay server-side; the browser
 * only ever sees the aggregated JSON.
 *
 * GET /api/analytics/umami-stats?period=7d   (7d | 30d | 90d)
 *
 * Required env vars (server-side, no VITE_ prefix):
 *   UMAMI_API_URL     — e.g. https://umami-navalcarnero.vercel.app
 *   UMAMI_USERNAME    — Umami user (e.g. admin)
 *   UMAMI_PASSWORD    — that user's password
 *   UMAMI_WEBSITE_ID  — same UUID as VITE_UMAMI_WEBSITE_ID
 */

export const config = { runtime: "edge" };

// The JWT is valid for far longer, but a short in-memory TTL keeps a rotated
// password or a revoked session from being honoured for hours by a warm instance.
const TOKEN_TTL_MS = 30 * 60 * 1000;
let cachedToken = null; // { token, expiresAt }

// Build start/end timestamps for the requested period
function getPeriodRange(period) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = period === "30d" ? 30 : period === "90d" ? 90 : 7;
  return {
    startAt: now - days * dayMs,
    endAt: now,
  };
}

// POST /api/auth/login → JWT used as Bearer on every other call
async function login(apiUrl, username, password) {
  const res = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Umami login failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data?.token) throw new Error("Umami login returned no token");
  return data.token;
}

async function getToken(apiUrl, username, password) {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const token = await login(apiUrl, username, password);
  cachedToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

// Fetch a single Umami endpoint with the Bearer token
async function umamiGet(apiUrl, path, token) {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Umami API error ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Every call the panel needs, in parallel
function fetchAll(apiUrl, websiteId, qs, token) {
  const base = `/api/websites/${websiteId}`;
  return Promise.all([
    // Visitors, pageviews, visits, bounces, total time
    umamiGet(apiUrl, `${base}/stats${qs}`, token),
    // Daily timeseries for the sparkline
    umamiGet(apiUrl, `${base}/pageviews${qs}&unit=day&timezone=Europe%2FMadrid`, token),
    // Top pages
    umamiGet(apiUrl, `${base}/metrics${qs}&type=url&limit=10`, token),
    // Device types (desktop / mobile / tablet)
    umamiGet(apiUrl, `${base}/metrics${qs}&type=device&limit=10`, token),
    // Top browsers
    umamiGet(apiUrl, `${base}/metrics${qs}&type=browser&limit=5`, token),
    // Top countries
    umamiGet(apiUrl, `${base}/metrics${qs}&type=country&limit=5`, token),
    // Custom events sent from the app (chat_question, business_search, ...)
    umamiGet(apiUrl, `${base}/metrics${qs}&type=event&limit=20`, token),
  ]);
}

export default async function handler(req) {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { UMAMI_API_URL, UMAMI_USERNAME, UMAMI_PASSWORD, UMAMI_WEBSITE_ID } = process.env;

  if (!UMAMI_API_URL || !UMAMI_USERNAME || !UMAMI_PASSWORD || !UMAMI_WEBSITE_ID) {
    return new Response(
      JSON.stringify({
        error:
          "Missing Umami env vars: UMAMI_API_URL, UMAMI_USERNAME, UMAMI_PASSWORD, UMAMI_WEBSITE_ID",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiUrl = UMAMI_API_URL.replace(/\/+$/, "");

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "7d";
  const { startAt, endAt } = getPeriodRange(period);
  const qs = `?startAt=${startAt}&endAt=${endAt}`;

  try {
    let token = await getToken(apiUrl, UMAMI_USERNAME, UMAMI_PASSWORD);

    let results;
    try {
      results = await fetchAll(apiUrl, UMAMI_WEBSITE_ID, qs, token);
    } catch (err) {
      // A cached token can expire or be invalidated server-side: log in again once.
      if (err.status !== 401 && err.status !== 403) throw err;
      cachedToken = null;
      token = await getToken(apiUrl, UMAMI_USERNAME, UMAMI_PASSWORD);
      results = await fetchAll(apiUrl, UMAMI_WEBSITE_ID, qs, token);
    }

    const [summary, pageviews, pages, devices, browsers, countries, events] = results;

    const payload = {
      period,
      summary,        // { pageviews, visitors, visits, bounces, totaltime }
      pageviews,      // { pageviews: [{x, y}], sessions: [{x, y}] }
      pages,          // [{ x: "/ruta", y: count }]
      devices,        // [{ x: "mobile", y: count }]
      browsers,       // [{ x: "Chrome", y: count }]
      countries,      // [{ x: "ES", y: count }]
      events,         // [{ x: "chat_question", y: count }]
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Cache for 5 minutes — stats don't need to be real-time
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[umami-stats]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
