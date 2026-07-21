/**
 * src/components/admin/UmamiStats.jsx
 *
 * Analytics section for /admin (panel superadmin).
 * Fetches data from our proxy route GET /api/analytics/umami-stats
 * and renders key metrics: visitors, pageviews, top pages, devices,
 * countries, browsers, and a daily sparkline chart.
 *
 * Props:
 *   umamiDashboardUrl  — direct link to your self-hosted Umami dashboard
 *                        (shown as a "Ver dashboard completo" button)
 *   onStatsLoaded      — callback(summary) fired when stats load, to expose
 *                        Umami's summary metrics to the parent component
 */

import { useState, useEffect, useCallback } from "react";

// --- Small helper components ---------------------------------------------------

/** A single KPI card (estética La Gaceta). Exported: la reutiliza AnaliticasOrganizacion. */
export function StatCard({ label, value, sub, icon }) {
  return (
    <div className="flex items-start gap-3 border border-tinta bg-papel p-4">
      {icon && <span className="text-2xl">{icon}</span>}
      <div className="min-w-0">
        <p className="truncate font-mono-ibm text-[9px] uppercase tracking-etiqueta text-mudo">{label}</p>
        <p className="font-serif-dm text-3xl leading-none text-tinta">{value}</p>
        {sub && <p className="mt-1 font-mono-ibm text-[10px] text-pardo">{sub}</p>}
      </div>
    </div>
  );
}

/**
 * Minimal SVG sparkline from an array of {x, y} daily values, con área
 * degradada y un punto marcando el pico. Exported: la reutiliza
 * AnaliticasOrganizacion.
 */
export function Sparkline({ data = [], color = "#b0472f", height = 48 }) {
  if (!data.length) return null;

  const values = data.map((d) => d.y ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 300;
  const pad = 6;

  const coords = values.map((v, i) => [
    pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2),
    height - pad - ((v - min) / range) * (height - pad * 2),
  ]);

  const polyline = coords.map(([x, y]) => `${x},${y}`).join(" ");

  // Build a closed polygon for the fill area
  const firstX = coords[0][0];
  const lastX = coords[coords.length - 1][0];
  const fillPath = `${firstX},${height} ${polyline} ${lastX},${height}`;

  // Punto en el día de más visitas (el primero si hay empate).
  const iPico = values.indexOf(Math.max(...values));
  const [px, py] = coords[iPico];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <polygon points={fillPath} fill="url(#sparkGrad)" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={px} cy={py} r="3.5" fill={color} stroke="#f4efe1" strokeWidth="1.5" />
    </svg>
  );
}

/** Día de más visitas de la serie, para anotar el pico junto al gráfico. */
export function picoDe(data = []) {
  if (!data.length) return null;
  let mejor = data[0];
  for (const d of data) if ((d.y ?? 0) > (mejor.y ?? 0)) mejor = d;
  return mejor;
}

// Colores de los segmentos del donut (y sus leyendas), en orden de serie.
const COLORES_DONUT = ["#b0472f", "#2f6b4f", "#c68a2e", "#3a4e86", "#8a3a58"];

/**
 * Donut SVG para repartos pequeños (dispositivos): segmentos sobre un anillo,
 * total en el centro y leyenda al lado con valor y porcentaje.
 */
export function Donut({ data = [], etiqueta = "sesiones", formatoLabel = (x) => x }) {
  const total = data.reduce((a, d) => a + (d.y ?? 0), 0);
  if (!total) return <p className="font-serif-spectral text-sm text-mudo">Sin datos</p>;

  const R = 40;
  const C = 2 * Math.PI * R;
  let acumulado = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-32 w-32 flex-none">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          {data.map((d, i) => {
            const frac = (d.y ?? 0) / total;
            const seg = (
              <circle
                key={d.x}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={COLORES_DONUT[i % COLORES_DONUT.length]}
                strokeWidth="14"
                strokeDasharray={`${frac * C} ${C}`}
                strokeDashoffset={-acumulado * C}
              />
            );
            acumulado += frac;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif-dm text-2xl leading-none text-tinta">{total}</span>
          <span className="font-mono-ibm text-[8px] uppercase tracking-etiqueta text-mudo">
            {etiqueta}
          </span>
        </div>
      </div>
      <ul className="min-w-[10rem] flex-1 space-y-2">
        {data.map((d, i) => {
          const pct = Math.round(((d.y ?? 0) / total) * 100);
          return (
            <li key={d.x} className="flex items-center gap-2 font-serif-spectral text-sm text-tinta">
              <span
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{ backgroundColor: COLORES_DONUT[i % COLORES_DONUT.length] }}
              />
              <span className="min-w-0 flex-1 truncate">{formatoLabel(d.x)}</span>
              <span className="font-mono-ibm text-[11px] text-pardo">
                {d.y} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Horizontal bar for a ranked list item (pages, countries, etc.): rango a dos
 * cifras en mono, y la barra del líder en terracota (el resto en ocre), como
 * en los rankings del resto del panel. Exported: la reutiliza
 * AnaliticasOrganizacion. `onClick` (opcional) vuelve la fila pulsable — lo
 * usa el desglose de países por región.
 */
export function RankBar({ label, value, total, rank, onClick, abierto = false }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const contenido = (
    <>
      <span className="w-5 text-right font-mono-ibm text-[10px] text-terracota">
        {String(rank).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="max-w-[200px] truncate text-tinta" title={label}>
            {label}
            {onClick && (
              <span className="ml-1 font-mono-ibm text-[9px] text-mudo">{abierto ? "▲" : "▼"}</span>
            )}
          </span>
          <span className="ml-2 shrink-0 font-mono-ibm text-[11px] text-pardo">
            {value.toLocaleString("es-ES")} · {pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden bg-filete/60">
          <div
            className={`h-full transition-all duration-500 ${rank === 1 ? "bg-terracota" : "bg-ocre"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 text-left font-serif-spectral text-sm transition-opacity hover:opacity-80"
      >
        {contenido}
      </button>
    );
  }
  return <div className="flex items-center gap-2 font-serif-spectral text-sm">{contenido}</div>;
}

// Friendly Spanish names for page routes
const PAGE_LABELS = {
  "/": "Inicio",
  "/eventos": "Eventos",
  "/comercios": "Comercios / Directorio",
  // Ruta antigua de la guía: sigue apareciendo en las visitas históricas.
  "/mapa": "Mapa / Directorio",
  "/noticias": "Noticias",
  "/transporte": "Transporte",
  "/asistente": "Asistente IA",
  "/login": "Organizaciones — Login",
  "/registro": "Organizaciones — Registro",
  "/admin": "Superadmin — Login / Panel",
  "/panel": "Panel de organización",
};

function friendlyPage(url) {
  // Strip query strings
  const path = url.split("?")[0];
  // Dynamic routes
  if (path.startsWith("/eventos/")) return "Evento (detalle)";
  if (path.startsWith("/noticias/")) return "Noticia (detalle)";
  return PAGE_LABELS[path] || path;
}

// Friendly device labels
const DEVICE_LABELS = {
  desktop: "Escritorio",
  laptop: "Escritorio",
  mobile: "Móvil",
  tablet: "Tablet",
};

// Nombre del país en español a partir del código ISO ("ES" → "España").
const NOMBRES_PAIS = new Intl.DisplayNames(["es"], { type: "region" });
function nombrePais(codigo) {
  if (!codigo) return "—";
  try {
    return NOMBRES_PAIS.of(codigo.toUpperCase()) ?? codigo.toUpperCase();
  } catch {
    return codigo.toUpperCase();
  }
}

// Umami devuelve las regiones como subdivisiones ISO 3166-2 ("ES-MD"). Para
// España las traducimos a nombre de comunidad; para el resto de países se
// muestra el código de subdivisión tal cual (no hay API estándar de nombres).
const REGIONES_ES = {
  AN: "Andalucía", AR: "Aragón", AS: "Asturias", CB: "Cantabria",
  CE: "Ceuta", CL: "Castilla y León", CM: "Castilla-La Mancha",
  CN: "Canarias", CT: "Cataluña", EX: "Extremadura", GA: "Galicia",
  IB: "Baleares", MC: "Región de Murcia", MD: "Comunidad de Madrid",
  ML: "Melilla", NC: "Navarra", PV: "País Vasco", RI: "La Rioja",
  VC: "Comunidad Valenciana",
};
function nombreRegion(codigo) {
  if (!codigo) return "Desconocida";
  const [pais, sub] = String(codigo).split("-");
  if (pais === "ES" && REGIONES_ES[sub]) return REGIONES_ES[sub];
  return sub || codigo;
}

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

/**
 * Lista de países con desglose por regiones: al pulsar un país se piden (y
 * cachean) sus regiones al proxy (`?pais=XX`) y se muestran anidadas bajo la
 * fila. Un solo país abierto a la vez.
 */
function ListaPaises({ countries, total, period }) {
  const [abierto, setAbierto] = useState(null); // código de país o null
  const [porPais, setPorPais] = useState({}); // { ES: { cargando, error, regiones } }

  // El cambio de periodo invalida el desglose cacheado.
  useEffect(() => {
    setPorPais({});
    setAbierto(null);
  }, [period]);

  const alternar = async (codigo) => {
    const siguiente = abierto === codigo ? null : codigo;
    setAbierto(siguiente);
    if (!siguiente || porPais[siguiente]) return;

    setPorPais((prev) => ({ ...prev, [siguiente]: { cargando: true } }));
    try {
      const res = await fetch(`/api/analytics/umami-stats?period=${period}&pais=${siguiente}`);
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error || `HTTP ${res.status}`);
      setPorPais((prev) => ({ ...prev, [siguiente]: { regiones: cuerpo.regiones ?? [] } }));
    } catch (err) {
      setPorPais((prev) => ({ ...prev, [siguiente]: { error: err.message } }));
    }
  };

  return (
    <div className="space-y-2.5">
      {countries.slice(0, 8).map((c, i) => {
        const codigo = (c.x || "").toUpperCase();
        const detalle = porPais[codigo];
        const totalRegiones = detalle?.regiones?.reduce((a, r) => a + (r.y ?? 0), 0) ?? 0;
        return (
          <div key={c.x}>
            <RankBar
              rank={i + 1}
              label={`${codigo} ${nombrePais(codigo)}`}
              value={c.y}
              total={total}
              onClick={() => alternar(codigo)}
              abierto={abierto === codigo}
            />
            {abierto === codigo && (
              <div className="animate-rise ml-7 mt-2 space-y-1.5 border-l-2 border-filete pl-3">
                {detalle?.cargando && (
                  <p className="font-mono-ibm text-[10px] uppercase tracking-etiqueta text-mudo">
                    Cargando regiones…
                  </p>
                )}
                {detalle?.error && (
                  <p className="font-serif-spectral text-xs text-terracota">{detalle.error}</p>
                )}
                {detalle?.regiones &&
                  (detalle.regiones.length === 0 ? (
                    <p className="font-serif-spectral text-xs text-mudo">
                      Sin datos de región para este país.
                    </p>
                  ) : (
                    detalle.regiones.map((r) => {
                      const pct = totalRegiones ? Math.round(((r.y ?? 0) / totalRegiones) * 100) : 0;
                      return (
                        <div key={r.x} className="flex items-center gap-2 font-serif-spectral text-[13px]">
                          <span className="min-w-0 flex-1 truncate text-tinta-apagada" title={r.x}>
                            {nombreRegion(r.x)}
                          </span>
                          <div className="h-1.5 w-24 flex-none overflow-hidden bg-filete/60">
                            <div className="h-full bg-ocre" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-14 flex-none text-right font-mono-ibm text-[10px] text-pardo">
                            {r.y} · {pct}%
                          </span>
                        </div>
                      );
                    })
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Main component -----------------------------------------------------------

export default function UmamiStats({ umamiDashboardUrl, onStatsLoaded }) {
  const [period, setPeriod] = useState("7d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics/umami-stats?period=${period}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const statsData = await res.json();
        setData(statsData);
        // Expose summary to parent
        if (onStatsLoaded && statsData?.summary) {
          onStatsLoaded(statsData.summary);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [period, onStatsLoaded]);

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
  const countries = data?.countries ?? [];
  const browsers = data?.browsers ?? [];
  const totalDevices = devices.reduce((a, d) => a + d.y, 0);
  const totalCountries = countries.reduce((a, c) => a + c.y, 0);
  const totalBrowsers = browsers.reduce((a, b) => a + b.y, 0);

  // Top custom events (from your existing POST /api/analytics/track calls)
  const events = (data?.events ?? []).slice(0, 8);

  // ---- Render ----------------------------------------------------------------
  return (
    <section className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-serif-dm text-2xl text-tinta">Analytics — Umami</h2>
          <p className="font-serif-spectral text-sm text-pardo">datos de uso real</p>
        </div>

        <div className="flex items-center gap-2 font-mono-ibm text-[10px] uppercase tracking-etiqueta">
          {/* Period selector */}
          <div className="flex gap-1.5">
            {[["7d", "7 días"], ["30d", "30 días"], ["90d", "90 días"]].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={`px-3 py-1.5 transition-colors ${
                  period === v ? "bg-tinta text-papel" : "border border-filete text-pardo hover:text-tinta"
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
              className="flex items-center gap-1.5 border border-tinta px-3 py-1.5 text-tinta transition-colors hover:bg-papel-calido"
            >
              <span>Dashboard completo</span>
              <span>↗</span>
            </a>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="border border-terracota/30 bg-terracota-fondo p-4 font-serif-spectral text-sm text-terracota">
          <strong>Error al cargar métricas:</strong> {error}
          <p className="mt-1 font-mono-ibm text-[10px]">
            Comprueba que UMAMI_API_URL, UMAMI_API_TOKEN y UMAMI_WEBSITE_ID están configurados en Vercel.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-papel-calido" />
          ))}
        </div>
      )}

      {/* Stats */}
      {!loading && data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Visitantes únicos"
              value={fmt(totalVisitors)}
              sub={`últimos ${period === "7d" ? "7" : period === "30d" ? "30" : "90"} días`}
            />
            <StatCard label="Páginas vistas" value={fmt(totalPageviews)} sub={`${fmt(totalVisits)} sesiones`} />
            <StatCard label="Tiempo medio" value={avgTime} sub="por sesión" />
            <StatCard
              label="Tasa de rebote"
              value={bounceRate !== null ? `${bounceRate}%` : "—"}
              sub="sesiones de 1 página"
            />
          </div>

          {/* Sparkline con anotación del pico */}
          {dailyViews.length > 1 && (
            <div className="border border-tinta bg-papel p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="font-mono-ibm text-[9px] uppercase tracking-etiqueta text-mudo">
                  Páginas vistas por día
                </p>
                {picoDe(dailyViews) && (
                  <p className="font-serif-spectral text-xs text-pardo">
                    Pico {picoDe(dailyViews).y} ·{" "}
                    {new Date(picoDe(dailyViews).x).toLocaleDateString("es-ES", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                )}
              </div>
              <Sparkline data={dailyViews} height={72} />
              <div className="mt-1 flex justify-between font-mono-ibm text-[9px] uppercase tracking-etiqueta text-mudo">
                <span>
                  {new Date(dailyViews[0]?.x).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                </span>
                <span>
                  {new Date(dailyViews[dailyViews.length - 1]?.x).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Pages + Devices + Countries + Browsers (2x2 grid) */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Top pages */}
            <div className="border border-tinta bg-papel p-4">
              <p className="mb-3 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-mudo">
                Secciones más visitadas
              </p>
              {pages.length === 0 ? (
                <p className="font-serif-spectral text-sm text-mudo">Sin datos</p>
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

            {/* Devices: donut con leyenda */}
            <div className="border border-tinta bg-papel p-4">
              <p className="mb-3 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-mudo">
                Dispositivos
              </p>
              <Donut
                data={devices}
                etiqueta="sesiones"
                formatoLabel={(x) => DEVICE_LABELS[x] ?? x}
              />
            </div>

            {/* Countries con desglose por regiones */}
            <div className="border border-tinta bg-papel p-4">
              <p className="mb-3 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-mudo">
                Países
              </p>
              {countries.length === 0 ? (
                <p className="font-serif-spectral text-sm text-mudo">Sin datos</p>
              ) : (
                <ListaPaises countries={countries} total={totalCountries} period={period} />
              )}
            </div>

            {/* Browsers */}
            <div className="border border-tinta bg-papel p-4">
              <p className="mb-3 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-mudo">
                Navegadores
              </p>
              {browsers.length === 0 ? (
                <p className="font-serif-spectral text-sm text-mudo">Sin datos</p>
              ) : (
                <div className="space-y-2.5">
                  {browsers.slice(0, 8).map((b, i) => (
                    <RankBar key={b.x} rank={i + 1} label={b.x} value={b.y} total={totalBrowsers} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Custom events (from your existing track calls) */}
          {events.length > 0 && (
            <div className="border border-tinta bg-papel p-4">
              <p className="mb-3 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-mudo">
                Interacciones más frecuentes
              </p>
              <div className="space-y-1.5">
                {events.map((e) => (
                  <div key={e.x} className="flex justify-between font-serif-spectral text-sm">
                    <span className="max-w-[180px] truncate text-tinta-apagada">{e.x}</span>
                    <span className="font-mono-ibm text-xs text-tinta">{fmt(e.y)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pitch: business discovery metrics */}
          <div className="border border-tinta bg-papel-calido p-6">
            <p className="mb-4 font-mono-ibm text-[9px] uppercase tracking-etiqueta text-terracota">
              Oportunidades para comercios locales
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="font-serif-dm text-4xl leading-none text-tinta">{fmt(totalVisitors)}</p>
                <p className="mt-1 font-serif-spectral text-sm text-pardo">Visitantes únicos</p>
              </div>
              <div className="text-center">
                <p className="font-serif-dm text-4xl leading-none text-tinta">{fmt(totalPageviews)}</p>
                <p className="mt-1 font-serif-spectral text-sm text-pardo">Páginas vistas</p>
              </div>
              <div className="text-center">
                <p className="font-serif-dm text-4xl leading-none text-tinta">{avgTime}</p>
                <p className="mt-1 font-serif-spectral text-sm text-pardo">Tiempo medio/sesión</p>
              </div>
            </div>
            <p className="mt-4 text-center font-serif-spectral text-sm text-tinta">
              <strong>Estos son los vecinos de Navalcarnero que podrían descubrir tu negocio en la app.</strong>
            </p>
          </div>
        </>
      )}
    </section>
  );
}
