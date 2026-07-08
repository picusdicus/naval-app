/**
 * fetch-comercios-google.mjs
 *
 * Fetches businesses in Navalcarnero from Google Places API (New),
 * normalizes them to the app's data shape, and writes the result
 * to src/data/comercios.json (replaces any existing content).
 *
 * Usage:
 *   node scripts/fetch-comercios-google.mjs
 *
 * Requires:
 *   GOOGLE_PLACES_KEY in .env (or already in process.env)
 *
 * Shape produced per comercio:
 *   id, nombre, categoria, subtipo, cocina, lat, lng,
 *   direccion, telefono, web, horario,
 *   rating, totalReviews, precioNivel
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/** Load .env without requiring the dotenv package */
function loadEnv() {
  const envPath = resolve(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const API_KEY = process.env.GOOGLE_PLACES_KEY;
if (!API_KEY) {
  console.error("ERROR: GOOGLE_PLACES_KEY not found. Add it to .env");
  process.exit(1);
}

const COMERCIOS_PATH = resolve(ROOT, "src/data/comercios.json");

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Navalcarnero municipality center */
const NAVALCARNERO_CENTER = { latitude: 40.2817, longitude: -4.0108 };

/** Search radius that covers the whole municipality */
const SEARCH_RADIUS_METERS = 4500;

/** Milliseconds between API calls to stay comfortably under quota (60 req/min) */
const API_THROTTLE_MS = 220;

// ---------------------------------------------------------------------------
// Category mapping: Google place types → our internal categories
// ---------------------------------------------------------------------------

/**
 * Maps an array of Google place types to { categoria, subtipo }.
 * Order matters: first match wins.
 * subtipo mirrors OSM values used in categorias.js so the UI needs no changes.
 */
const CATEGORY_RULES = [
  // Alimentacion
  { types: ["supermarket"],             categoria: "alimentacion",   subtipo: "supermarket" },
  { types: ["grocery_store"],           categoria: "alimentacion",   subtipo: "supermarket" },
  { types: ["convenience_store"],       categoria: "alimentacion",   subtipo: "convenience" },
  { types: ["bakery"],                  categoria: "alimentacion",   subtipo: "bakery" },
  { types: ["butcher_shop"],            categoria: "alimentacion",   subtipo: "butcher" },
  { types: ["deli"],                    categoria: "alimentacion",   subtipo: "deli" },
  { types: ["greengrocer"],             categoria: "alimentacion",   subtipo: "greengrocer" },
  { types: ["market"],                  categoria: "alimentacion",   subtipo: "marketplace" },
  { types: ["liquor_store"],            categoria: "alimentacion",   subtipo: "alcohol" },

  // Restauracion
  { types: ["restaurant"],              categoria: "restauracion",   subtipo: "restaurant" },
  { types: ["cafe", "coffee_shop"],     categoria: "restauracion",   subtipo: "cafe" },
  { types: ["bar"],                     categoria: "restauracion",   subtipo: "bar" },
  { types: ["fast_food_restaurant"],    categoria: "restauracion",   subtipo: "fast_food" },
  { types: ["pizza_restaurant"],        categoria: "restauracion",   subtipo: "pizza" },
  { types: ["sandwich_shop"],           categoria: "restauracion",   subtipo: "sandwich" },
  { types: ["ice_cream_shop"],          categoria: "restauracion",   subtipo: "ice_cream" },
  { types: ["dessert_shop"],            categoria: "restauracion",   subtipo: "pastry" },
  { types: ["meal_takeaway"],           categoria: "restauracion",   subtipo: "fast_food" },

  // Salud
  { types: ["pharmacy"],                categoria: "salud",          subtipo: "pharmacy" },
  { types: ["hospital"],                categoria: "salud",          subtipo: "hospital" },
  { types: ["doctor"],                  categoria: "salud",          subtipo: "doctors" },
  { types: ["dentist"],                 categoria: "salud",          subtipo: "dentist" },
  { types: ["physiotherapist"],         categoria: "salud",          subtipo: "physiotherapist" },
  { types: ["optician"],                categoria: "salud",          subtipo: "optician" },
  { types: ["veterinary_care"],         categoria: "salud",          subtipo: "veterinary" },

  // Belleza
  { types: ["hair_salon", "hair_care"], categoria: "belleza",        subtipo: "hairdresser" },
  { types: ["beauty_salon"],            categoria: "belleza",        subtipo: "beauty" },
  { types: ["nail_salon"],              categoria: "belleza",        subtipo: "beauty" },
  { types: ["barber_shop"],             categoria: "belleza",        subtipo: "barber" },
  { types: ["spa"],                     categoria: "belleza",        subtipo: "beauty" },

  // Hogar
  { types: ["furniture_store"],         categoria: "hogar",          subtipo: "furniture" },
  { types: ["hardware_store"],          categoria: "hogar",          subtipo: "doityourself" },
  { types: ["home_goods_store"],        categoria: "hogar",          subtipo: "houseware" },
  { types: ["florist"],                 categoria: "hogar",          subtipo: "florist" },
  { types: ["garden_center"],           categoria: "hogar",          subtipo: "garden_centre" },
  { types: ["pet_store"],               categoria: "hogar",          subtipo: "pet" },

  // Servicios
  { types: ["gym", "fitness_center"],   categoria: "servicios",      subtipo: "gym" },
  { types: ["laundry", "laundromat"],   categoria: "servicios",      subtipo: "laundry" },
  { types: ["car_wash"],                categoria: "servicios",      subtipo: "car_wash" },
  { types: ["car_repair"],              categoria: "servicios",      subtipo: "car_repair" },
  { types: ["car_dealer"],              categoria: "servicios",      subtipo: "car" },
  { types: ["gas_station"],             categoria: "servicios",      subtipo: "fuel" },
  { types: ["bank"],                    categoria: "servicios",      subtipo: "bank" },
  { types: ["atm"],                     categoria: "servicios",      subtipo: "atm" },
  { types: ["post_office"],             categoria: "servicios",      subtipo: "post_office" },
  { types: ["travel_agency"],           categoria: "servicios",      subtipo: "travel_agency" },
  { types: ["library"],                 categoria: "servicios",      subtipo: "library" },
  { types: ["dry_cleaning"],            categoria: "servicios",      subtipo: "dry_cleaning" },

  // Servicios profesionales
  { types: ["lawyer"],                  categoria: "servicios_prof", subtipo: "lawyer" },
  { types: ["accounting"],              categoria: "servicios_prof", subtipo: "accountant" },
  { types: ["insurance_agency"],        categoria: "servicios_prof", subtipo: "insurance" },
  { types: ["real_estate_agency"],      categoria: "servicios_prof", subtipo: "estate_agent" },
  { types: ["notary_public"],           categoria: "servicios_prof", subtipo: "notary" },
  { types: ["it_company"],              categoria: "servicios_prof", subtipo: "computer" },
  { types: ["moving_company"],          categoria: "servicios_prof", subtipo: "moving" },
];

function mapGoogleTypes(googleTypes = []) {
  for (const rule of CATEGORY_RULES) {
    if (rule.types.some((t) => googleTypes.includes(t))) {
      return { categoria: rule.categoria, subtipo: rule.subtipo };
    }
  }
  if (googleTypes.some((t) => t.includes("food") || t.includes("restaurant"))) {
    return { categoria: "restauracion", subtipo: "restaurant" };
  }
  if (googleTypes.some((t) => t.includes("store") || t.includes("shop"))) {
    return { categoria: "hogar", subtipo: "shop" };
  }
  return { categoria: "servicios", subtipo: "service" };
}

// ---------------------------------------------------------------------------
// Google Places API (New) wrappers
// ---------------------------------------------------------------------------

const PLACES_BASE = "https://places.googleapis.com/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /places:searchText
 * Lightweight fields only — cheapest SKU, used just to collect place IDs.
 */
async function searchText(query, pageToken = null) {
  const body = {
    textQuery: query,
    locationBias: {
      circle: { center: NAVALCARNERO_CENTER, radius: SEARCH_RADIUS_METERS },
    },
    maxResultCount: 20,
    languageCode: "es",
  };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.types,places.location," +
        "places.formattedAddress,nextPageToken",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`searchText [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  return { places: data.places || [], nextPageToken: data.nextPageToken || null };
}

/**
 * GET /places/{id}
 * Full details per place: contact info, hours, rating, price level.
 */
async function getDetails(placeId) {
  const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": API_KEY,
      // All fields we want — adding rating, userRatingCount, priceLevel
      "X-Goog-FieldMask":
        "id,displayName,types,location,formattedAddress," +
        "nationalPhoneNumber,websiteUri,regularOpeningHours," +
        "rating,userRatingCount,priceLevel,primaryTypeDisplayName",
      "Accept-Language": "es",
    },
  });
  if (!res.ok) throw new Error(`getDetails(${placeId}) [${res.status}]: ${await res.text()}`);
  return res.json();
}

/**
 * Converts Google's regularOpeningHours to a readable Spanish string.
 * Example: "Lunes: 09:00–21:30 | Martes: 09:00–21:30 | ..."
 */
function formatHours(regularOpeningHours) {
  if (!regularOpeningHours?.weekdayDescriptions?.length) return "";
  return regularOpeningHours.weekdayDescriptions.join(" | ");
}

/**
 * Converts Google's priceLevel enum to a short token.
 * PRICE_LEVEL_FREE → "FREE", PRICE_LEVEL_MODERATE → "MODERATE", etc.
 */
function formatPriceLevel(priceLevel) {
  if (!priceLevel) return "";
  // Google returns e.g. "PRICE_LEVEL_MODERATE" — strip the prefix
  return priceLevel.replace("PRICE_LEVEL_", "");
}

// ---------------------------------------------------------------------------
// Search queries — broad coverage, low cost
// ---------------------------------------------------------------------------

/**
 * 8 broad queries cover all commercial categories in Navalcarnero.
 * Google returns up to 20 results per page; locationBias keeps them local.
 * Estimated total: ~8 search calls + ~150-200 detail calls (~$3-4 one-time).
 */
const SEARCH_QUERIES = [
  "restaurantes bares cafeterias Navalcarnero Madrid",
  "supermercados tiendas alimentacion Navalcarnero Madrid",
  "farmacias clinicas medicos dentistas Navalcarnero Madrid",
  "peluquerias belleza estetica Navalcarnero Madrid",
  "ferreterias muebles hogar Navalcarnero Madrid",
  "bancos gasolineras servicios Navalcarnero Madrid",
  "gimnasios lavanderia talleres Navalcarnero Madrid",
  "abogados gestoras inmobiliarias seguros Navalcarnero Madrid",
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Navalcarnero Vecinal — Google Places fetch script");
  console.log("=".repeat(55));

  // ── Phase 1: collect unique place IDs via text search ─────────────────────
  console.log("\nPhase 1 — Text search");
  const rawPlaces = new Map(); // googleId => basic place object
  let searchCalls = 0;

  for (const query of SEARCH_QUERIES) {
    let pageToken = null;
    let page = 1;
    process.stdout.write(`  "${query}" `);

    do {
      try {
        const { places, nextPageToken } = await searchText(query, pageToken);
        searchCalls++;
        let added = 0;
        for (const p of places) {
          if (!rawPlaces.has(p.id)) { rawPlaces.set(p.id, p); added++; }
        }
        process.stdout.write(`[p${page}:+${added}] `);
        pageToken = nextPageToken;
        page++;
        if (pageToken) await sleep(API_THROTTLE_MS);
      } catch (err) {
        process.stdout.write(`[ERR] `);
        console.error(err.message);
        break;
      }
    } while (pageToken);

    console.log();
    await sleep(API_THROTTLE_MS);
  }

  console.log(`\n  Total unique places found: ${rawPlaces.size}`);
  console.log(`  Search calls used: ${searchCalls}\n`);

  // ── Phase 2: fetch full details for every unique place ────────────────────
  console.log("Phase 2 — Place details");
  const comercios = [];
  let detailCalls = 0;
  let detailErrors = 0;
  let skipped = 0;
  const ids = Array.from(rawPlaces.keys());

  for (let i = 0; i < ids.length; i++) {
    const googleId = ids[i];
    if (i % 25 === 0) console.log(`  [${i + 1}/${ids.length}]`);

    try {
      const d = await getDetails(googleId);
      detailCalls++;

      const lat = d.location?.latitude  ?? 0;
      const lng = d.location?.longitude ?? 0;

      // Skip places without valid coordinates — can't be shown on map
      if (!lat || !lng) { skipped++; continue; }

      const { categoria, subtipo } = mapGoogleTypes(d.types || []);

      comercios.push({
        id:          `gpl_${googleId}`,
        nombre:      d.displayName?.text || rawPlaces.get(googleId)?.displayName?.text || "",
        categoria,
        subtipo,
        cocina:      [],   // Google has no cuisine tags; kept for UI shape compatibility
        lat,
        lng,
        direccion:   d.formattedAddress        || "",
        telefono:    d.nationalPhoneNumber      || "",
        web:         d.websiteUri               || "",
        horario:     formatHours(d.regularOpeningHours),
        // New fields
        rating:      d.rating                  ?? null,
        totalReviews: d.userRatingCount         ?? null,
        precioNivel: formatPriceLevel(d.priceLevel),
        // Human-readable type label in Spanish, e.g. "Pizzería", "Supermercado", "Peluquería"
        // Used for semantic search without needing manual keyword mappings.
        tipoDisplay: d.primaryTypeDisplayName?.text || "",
      });

      await sleep(API_THROTTLE_MS);
    } catch (err) {
      detailErrors++;
      console.error(`  WARN ${googleId}: ${err.message.slice(0, 80)}`);
    }
  }

  console.log(`  Detail calls: ${detailCalls}  |  errors: ${detailErrors}  |  skipped (no coords): ${skipped}\n`);

  // ── Phase 3: sort and write ───────────────────────────────────────────────
  comercios.sort((a, b) => {
    if (a.categoria !== b.categoria)
      return a.categoria.localeCompare(b.categoria, "es");
    return a.nombre.localeCompare(b.nombre, "es");
  });

  mkdirSync(dirname(COMERCIOS_PATH), { recursive: true });
  writeFileSync(COMERCIOS_PATH, JSON.stringify(comercios, null, 2) + "\n", "utf-8");

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalCalls = searchCalls + detailCalls;
  console.log("=".repeat(55));
  console.log(`Done!  ${comercios.length} comercios written to src/data/comercios.json`);
  console.log("\nBy category:");
  const byCat = comercios.reduce((acc, c) => {
    acc[c.categoria] = (acc[c.categoria] || 0) + 1; return acc;
  }, {});
  Object.entries(byCat)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, n]) => console.log(`  ${cat.padEnd(22)} ${n}`));

  // Stats on enriched fields
  const withPhone   = comercios.filter(c => c.telefono).length;
  const withWeb     = comercios.filter(c => c.web).length;
  const withHours   = comercios.filter(c => c.horario).length;
  const withRating  = comercios.filter(c => c.rating).length;
  console.log("\nField coverage:");
  console.log(`  telefono     ${withPhone}/${comercios.length}`);
  console.log(`  web          ${withWeb}/${comercios.length}`);
  console.log(`  horario      ${withHours}/${comercios.length}`);
  console.log(`  rating       ${withRating}/${comercios.length}`);

  console.log(`\nAPI calls used: ${totalCalls}  (~$${(totalCalls * 0.017).toFixed(2)})`);
  console.log(`  ${searchCalls} search  +  ${detailCalls} detail`);
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
