/**
 * src/components/admin/UmamiStats.jsx
 *
 * Analytics section for /admin/super.
 * Fetches data from our proxy route GET /api/analytics/umami-stats
 * and renders key metrics: visitors, pageviews, top pages, devices,
 * and a daily sparkline chart.
 *
 * Props:
 *   umamiDashboardUrl  — direct link to your self-hosted Umami dashboard
 *                        (shown as a "Ver dashboard completo" button)
 */

import { useState, useEffect, useCallback } from "react";

// --- Small helper components ---------------------------------------------------

/** A single KPI card */
function StatCard({ label, value, sub, icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 shadow-sm">
      <span className="text-2xl">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/** Minimal SVG sparkline from an array of {x, y} daily values */
function Sparkline({ data = [], color = "#2563eb", height = 48 }) {
  if (!data.length) return null;

  const values = data.map((d) => d.y ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 300;
  const pad = 4;

  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  // Build a closed polygon for the fill area
  const firstX = points[0].split(",")[0];
  const lastX = points[points.length - 1].split(",")[0];
  const fillPath = `${firstX},${height} ${polyline} ${lastX},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={fillPath} fill="url(#sparkGrad)" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Horizontal bar for a ranked list item (pages, devices, etc.) */
function RankBar({ label, value, total, rank }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-400 w-4 text-right text-xs">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-0.5">
          <span className="text-gray-700 truncate max-w-[180px]" title={label}>{label}</span>
          <span className="text-gray-500 text-xs ml-2 shrink-0">{value.toLocaleString("es-ES")} ({pct}%)</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Friendly Spanish names for page routes
const PAGE_LABELS = {
  "/": "Inicio",
  "/eventos": "Eventos",
  "/mapa": "Mapa / Directorio",
  "/noticias": "Noticias",
  "/transporte": "Transporte",
  "/asistente": "Asistente IA",
  "/admin/super": "Panel Admin",
};

function friendlyPage(url) {
  // Strip query strings
  const path = url.split("?")[0];
  return PAGE_LABELS[path] || path;
}

// Friendly device labels
const DEVICE_LABELS = { desktop: "🖥️ Escritorio", mobile: "📱 Móvil", tablet: "🪬 Tablet" };

// Format seconds to "Xm Ys"
function formatSeconds(s) {
  const secs = Math.round(s ?? 0);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

// Format number with Spanish locale
function fmt(n) {
  return (n ?? 0).toLocaleString("es-ES");
}

// --- Main component -----------------------------------------------------------

export default function UmamiStats({ umamiDashboardUrl }) {
  const [period, setPeriod] = useState("7d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/umami-stats?period=${p}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(period);
  }, [period, fetchStats]);

  // ---- Derived values --------------------------------------------------------
  const s = data?.summary ?? {};
  const totalPageviews = s.pageviews?.value ?? 0;
  const totalVisitors = s.visitors?.value ?? 0;
  const totalVisits = s.visits?.value ?? 0;
  const bounceRate = s.bounces?.value && s.visits?.value
    ? Math.round((s.bounces.value / s.visits.value) * 100)
    : null;
  const avgTime = s.totaltime?.value && s.visits?.value
    ? formatSeconds(s.totaltime.value / s.visits.value)
    : "—";

  const dailyViews = data?.pageviews?.pageviews ?? [];
  const pages = data?.pages ?? [];
  const devices = data?.devices ?? [];
  const totalDevices = devices.reduce((a, d) => a + d.y, 0);

  // Top custom events (from your existing POST /api/analytics/track calls)
  const events = (data?.events ?? []).slice(0, 8);

  // ---- Render ----------------------------------------------------------------
  return (
    <section className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Analytics — Umami</h2>
          <p className="text-sm text-gray-500">Datos de uso real de la app</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {[["7d", "7 días"], ["30d", "30 días"], ["90d", "90 días"]].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={`px-3 py-1.5 transition-colors ${
                  period === v
                    ? "bg-blue-600 text-white font-medium"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Link to full Umami dashboard */}
          {umamiDashboardUrl && (
            <a
              href={umamiDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <span>Ver dashboard completo</span>
              <span className="text-xs">↗</span>
            </a>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <strong>Error al cargar métricas:</strong> {error}
          <p className="mt-1 text-red-500 text-xs">
            Comprueba que UMAMI_API_URL, UMAMI_API_TOKEN y UMAMI_WEBSITE_ID están configurados en Vercel.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl" />
          ))}
        </div>
      )}

      {/* Stats */}
      {!loading && data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon="👥"
              label="Visitantes únicos"
              value={fmt(totalVisitors)}
              sub={`en los últimos ${period === "7d" ? "7" : period === "30d" ? "30" : "90"} días`}
            />
            <StatCard
              icon="📄"
              label="Páginas vistas"
              value={fmt(totalPageviews)}
              sub={`${fmt(totalVisits)} sesiones`}
            />
            <StatCard
              icon="⏱️"
              label="Tiempo medio"
              value={avgTime}
              sub="por sesión"
            />
            <StatCard
              icon="↩️"
              label="Tasa de rebote"
              value={bounceRate !== null ? `${bounceRate}%` : "—"}
              sub="sesiones de 1 página"
            />
          </div>

          {/* Sparkline */}
          {dailyViews.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                Páginas vistas por día
              </p>
              <Sparkline data={dailyViews} color="#2563eb" height={56} />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{dailyViews[0]?.x}</span>
                <span>{dailyViews[dailyViews.length - 1]?.x}</span>
              </div>
            </div>
          )}

          {/* Pages + Devices side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top pages */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                Secciones más visitadas
              </p>
              {pages.length === 0 ? (
                <p className="text-sm text-gray-400">Sin datos</p>
              ) : (
                <div className="space-y-2.5">
                  {pages.slice(0, 8).map((p, i) => (
                    <RankBar
                      key={p.x}
                      rank={i + 1}
                      label={friendlyPage(p.x)}
                      value={p.y}
                      total={totalPageviews}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Devices */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                  Dispositivos
                </p>
                {devices.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin datos</p>
                ) : (
                  <div className="space-y-2.5">
                    {devices.map((d, i) => (
                      <RankBar
                        key={d.x}
                        rank={i + 1}
                        label={DEVICE_LABELS[d.x] ?? d.x}
                        value={d.y}
                        total={totalDevices}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Custom events (from your existing track calls) */}
              {events.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">
                    Interacciones más frecuentes
                  </p>
                  <div className="space-y-1.5">
                    {events.map((e) => (
                      <div key={e.x} className="flex justify-between text-sm">
                        <span className="text-gray-600 truncate max-w-[180px]">{e.x}</span>
                        <span className="text-gray-900 font-medium">{fmt(e.y)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pitch note for local businesses */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
            <strong>💡 Dato para comercios:</strong> En los últimos{" "}
            {period === "7d" ? "7 días" : period === "30d" ? "30 días" : "90 días"},{" "}
            <strong>{fmt(totalVisitors)} vecinos únicos</strong> han usado la app —
            cada uno es un potencial cliente de los negocios locales listados en el directorio.
          </div>
        </>
      )}
    </section>
  );
}
