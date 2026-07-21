/**
 * fetch-comercios-google.mjs
 *
 * Fetches businesses, services, sports, culture and education venues
 * in Navalcarnero from Google Places API (New), normalizes them to the
 * app's data shape, and writes the result to src/data/comercios.json.
 *
 * Usage:
 *   node scripts/fetch-comercios-google.mjs
 *
 * Requires:
 *   GOOGLE_PLACES_KEY in .env (or already in process.env)
 *
 * Categories (10 total):
 *   alimentacion, restauracion, salud, belleza, hogar,
 *   servicios, servicios_prof,
 *   deporte     ← new (moved gym/fitness from servicios)
 *   ocio_cultura ← new (theatre, cinema, cultural centres)
 *   educacion   ← new (schools, academies, dance, languages)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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

const NAVALCARNERO_CENTER = { latitude: 40.2817, longitude: -4.0108 };
const SEARCH_RADIUS_METERS = 4500;
const API_THROTTLE_MS = 220;

// ---------------------------------------------------------------------------
// Category mapping: Google place types → our internal categories
// ---------------------------------------------------------------------------

/**
 * Maps Google place types to { categoria, subtipo }.
 * Order matters: first match wins.
 *
 * NEW categories vs previous version:
 *   deporte      — gym/fitness moved here + new sports venues
 *   ocio_cultura — theatre, cinema, museums, cultural centres
 *   educacion    — schools, academies, dance, languages, driving schools
 */
const CATEGORY_RULES = [
  // ── Alimentacion ──────────────────────────────────────────────────────────
  { types: ["supermarket"],              categoria: "alimentacion",   subtipo: "supermarket" },
  { types: ["grocery_store"],            categoria: "alimentacion",   subtipo: "supermarket" },
  { types: ["convenience_store"],        categoria: "alimentacion",   subtipo: "convenience" },
  { types: ["bakery"],                   categoria: "alimentacion",   subtipo: "bakery" },
  { types: ["butcher_shop"],             categoria: "alimentacion",   subtipo: "butcher" },
  { types: ["deli"],                     categoria: "alimentacion",   subtipo: "deli" },
  { types: ["greengrocer"],              categoria: "alimentacion",   subtipo: "greengrocer" },
  { types: ["market"],                   categoria: "alimentacion",   subtipo: "marketplace" },
  { types: ["liquor_store"],             categoria: "alimentacion",   subtipo: "alcohol" },
  { types: ["candy_store"],              categoria: "alimentacion",   subtipo: "confectionery" },
  { types: ["chocolate_factory"],        categoria: "alimentacion",   subtipo: "confectionery" },

  // ── Restauracion ──────────────────────────────────────────────────────────
  { types: ["restaurant"],               categoria: "restauracion",   subtipo: "restaurant" },
  { types: ["cafe", "coffee_shop"],      categoria: "restauracion",   subtipo: "cafe" },
  { types: ["bar"],                      categoria: "restauracion",   subtipo: "bar" },
  { types: ["fast_food_restaurant"],     categoria: "restauracion",   subtipo: "fast_food" },
  { types: ["pizza_restaurant"],         categoria: "restauracion",   subtipo: "pizza" },
  { types: ["sandwich_shop"],            categoria: "restauracion",   subtipo: "sandwich" },
  { types: ["ice_cream_shop"],           categoria: "restauracion",   subtipo: "ice_cream" },
  { types: ["dessert_shop"],             categoria: "restauracion",   subtipo: "pastry" },
  { types: ["meal_takeaway"],            categoria: "restauracion",   subtipo: "fast_food" },
  { types: ["brunch_restaurant"],        categoria: "restauracion",   subtipo: "restaurant" },
  { types: ["seafood_restaurant"],       categoria: "restauracion",   subtipo: "restaurant" },
  { types: ["steak_house"],              categoria: "restauracion",   subtipo: "restaurant" },
  { types: ["tapas_bar"],                categoria: "restauracion",   subtipo: "bar" },
  { types: ["wine_bar"],                 categoria: "restauracion",   subtipo: "bar" },

  // ── Salud ─────────────────────────────────────────────────────────────────
  { types: ["pharmacy"],                 categoria: "salud",          subtipo: "pharmacy" },
  { types: ["hospital"],                 categoria: "salud",          subtipo: "hospital" },
  { types: ["doctor"],                   categoria: "salud",          subtipo: "doctors" },
  { types: ["dentist"],                  categoria: "salud",          subtipo: "dentist" },
  { types: ["physiotherapist"],          categoria: "salud",          subtipo: "physiotherapist" },
  { types: ["optician"],                 categoria: "salud",          subtipo: "optician" },
  { types: ["veterinary_care"],          categoria: "salud",          subtipo: "veterinary" },
  { types: ["mental_health_practitioner"], categoria: "salud",        subtipo: "doctors" },
  { types: ["nutritionist_dietitian"],   categoria: "salud",          subtipo: "doctors" },

  // ── Belleza ───────────────────────────────────────────────────────────────
  { types: ["hair_salon", "hair_care"],  categoria: "belleza",        subtipo: "hairdresser" },
  { types: ["beauty_salon"],             categoria: "belleza",        subtipo: "beauty" },
  { types: ["nail_salon"],               categoria: "belleza",        subtipo: "beauty" },
  { types: ["barber_shop"],              categoria: "belleza",        subtipo: "barber" },
  { types: ["spa"],                      categoria: "belleza",        subtipo: "beauty" },
  { types: ["massage"],                  categoria: "belleza",        subtipo: "beauty" },
  { types: ["tattoo_parlor"],            categoria: "belleza",        subtipo: "beauty" },

  // ── Hogar ─────────────────────────────────────────────────────────────────
  { types: ["furniture_store"],          categoria: "hogar",          subtipo: "furniture" },
  { types: ["hardware_store"],           categoria: "hogar",          subtipo: "doityourself" },
  { types: ["home_goods_store"],         categoria: "hogar",          subtipo: "houseware" },
  { types: ["florist"],                  categoria: "hogar",          subtipo: "florist" },
  { types: ["garden_center"],            categoria: "hogar",          subtipo: "garden_centre" },
  { types: ["pet_store"],                categoria: "hogar",          subtipo: "pet" },
  { types: ["appliance_store"],          categoria: "hogar",          subtipo: "houseware" },
  { types: ["electronics_store"],        categoria: "hogar",          subtipo: "electronics" },
  { types: ["clothing_store"],           categoria: "hogar",          subtipo: "clothes" },
  { types: ["shoe_store"],               categoria: "hogar",          subtipo: "shoes" },
  { types: ["book_store"],               categoria: "hogar",          subtipo: "books" },
  { types: ["toy_store"],                categoria: "hogar",          subtipo: "toys" },
  { types: ["sporting_goods_store"],     categoria: "hogar",          subtipo: "sports" },
  { types: ["pharmacy"],                 categoria: "salud",          subtipo: "pharmacy" }, // already above

  // ── Deporte (NEW) ─────────────────────────────────────────────────────────
  // Gym/fitness moved from servicios to deporte
  { types: ["gym", "fitness_center"],    categoria: "deporte",        subtipo: "gym" },
  { types: ["sports_complex"],           categoria: "deporte",        subtipo: "sports_centre" },
  { types: ["stadium"],                  categoria: "deporte",        subtipo: "stadium" },
  { types: ["swimming_pool"],            categoria: "deporte",        subtipo: "swimming_pool" },
  { types: ["golf_course"],              categoria: "deporte",        subtipo: "golf_course" },
  { types: ["tennis_court"],             categoria: "deporte",        subtipo: "tennis" },
  { types: ["bowling_alley"],            categoria: "deporte",        subtipo: "bowling" },
  { types: ["ice_skating_rink"],         categoria: "deporte",        subtipo: "ice_rink" },
  { types: ["ski_resort"],               categoria: "deporte",        subtipo: "skiing" },
  { types: ["sports_club"],              categoria: "deporte",        subtipo: "sports_centre" },
  { types: ["martial_arts_school"],      categoria: "deporte",        subtipo: "martial_arts" },
  { types: ["yoga_studio"],              categoria: "deporte",        subtipo: "yoga" },
  { types: ["climbing_gym"],             categoria: "deporte",        subtipo: "climbing" },
  { types: ["cycling_park"],             categoria: "deporte",        subtipo: "cycling" },

  // ── Ocio y cultura (NEW) ──────────────────────────────────────────────────
  { types: ["performing_arts_theater"],  categoria: "ocio_cultura",   subtipo: "theatre" },
  { types: ["movie_theater"],            categoria: "ocio_cultura",   subtipo: "cinema" },
  { types: ["museum"],                   categoria: "ocio_cultura",   subtipo: "museum" },
  { types: ["art_gallery"],              categoria: "ocio_cultura",   subtipo: "gallery" },
  { types: ["cultural_center"],          categoria: "ocio_cultura",   subtipo: "cultural_centre" },
  { types: ["concert_hall"],             categoria: "ocio_cultura",   subtipo: "theatre" },
  { types: ["event_venue"],              categoria: "ocio_cultura",   subtipo: "venue" },
  { types: ["convention_center"],        categoria: "ocio_cultura",   subtipo: "venue" },
  { types: ["amusement_park"],           categoria: "ocio_cultura",   subtipo: "amusement_park" },
  { types: ["park"],                     categoria: "ocio_cultura",   subtipo: "park" },
  { types: ["playground"],               categoria: "ocio_cultura",   subtipo: "playground" },
  { types: ["tourist_attraction"],       categoria: "ocio_cultura",   subtipo: "attraction" },
  { types: ["casino"],                   categoria: "ocio_cultura",   subtipo: "casino" },
  { types: ["night_club"],               categoria: "ocio_cultura",   subtipo: "nightclub" },
  { types: ["karaoke"],                  categoria: "ocio_cultura",   subtipo: "nightclub" },
  { types: ["escape_room"],              categoria: "ocio_cultura",   subtipo: "attraction" },

  // ── Educacion (NEW) ───────────────────────────────────────────────────────
  { types: ["school"],                   categoria: "educacion",      subtipo: "school" },
  { types: ["primary_school"],           categoria: "educacion",      subtipo: "school" },
  { types: ["secondary_school"],         categoria: "educacion",      subtipo: "school" },
  { types: ["university"],               categoria: "educacion",      subtipo: "university" },
  { types: ["preschool"],                categoria: "educacion",      subtipo: "kindergarten" },
  { types: ["child_care_agency"],        categoria: "educacion",      subtipo: "kindergarten" },
  { types: ["driving_school"],           categoria: "educacion",      subtipo: "driving_school" },
  { types: ["language_school"],          categoria: "educacion",      subtipo: "language_school" },
  { types: ["tutoring_center"],          categoria: "educacion",      subtipo: "academy" },
  { types: ["dance_school"],             categoria: "educacion",      subtipo: "dance_school" },
  { types: ["music_school"],             categoria: "educacion",      subtipo: "music_school" },
  { types: ["art_school"],               categoria: "educacion",      subtipo: "art_school" },
  { types: ["cooking_school"],           categoria: "educacion",      subtipo: "academy" },

  // ── Servicios ─────────────────────────────────────────────────────────────
  { types: ["laundry", "laundromat"],    categoria: "servicios",      subtipo: "laundry" },
  { types: ["car_wash"],                 categoria: "servicios",      subtipo: "car_wash" },
  { types: ["car_repair"],               categoria: "servicios",      subtipo: "car_repair" },
  { types: ["car_dealer"],               categoria: "servicios",      subtipo: "car" },
  { types: ["gas_station"],              categoria: "servicios",      subtipo: "fuel" },
  { types: ["bank"],                     categoria: "servicios",      subtipo: "bank" },
  { types: ["atm"],                      categoria: "servicios",      subtipo: "atm" },
  { types: ["post_office"],              categoria: "servicios",      subtipo: "post_office" },
  { types: ["travel_agency"],            categoria: "servicios",      subtipo: "travel_agency" },
  { types: ["library"],                  categoria: "servicios",      subtipo: "library" },
  { types: ["dry_cleaning"],             categoria: "servicios",      subtipo: "dry_cleaning" },
  { types: ["lodging", "hotel"],         categoria: "servicios",      subtipo: "hotel" },
  { types: ["hostel"],                   categoria: "servicios",      subtipo: "hotel" },
  { types: ["parking"],                  categoria: "servicios",      subtipo: "parking" },
  { types: ["storage"],                  categoria: "servicios",      subtipo: "storage" },
  { types: ["courier_service"],          categoria: "servicios",      subtipo: "courier" },
  { types: ["funeral_home"],             categoria: "servicios",      subtipo: "funeral" },

  // ── Servicios profesionales ───────────────────────────────────────────────
  { types: ["lawyer"],                   categoria: "servicios_prof", subtipo: "lawyer" },
  { types: ["accounting"],               categoria: "servicios_prof", subtipo: "accountant" },
  { types: ["insurance_agency"],         categoria: "servicios_prof", subtipo: "insurance" },
  { types: ["real_estate_agency"],       categoria: "servicios_prof", subtipo: "estate_agent" },
  { types: ["notary_public"],            categoria: "servicios_prof", subtipo: "notary" },
  { types: ["it_company"],               categoria: "servicios_prof", subtipo: "computer" },
  { types: ["moving_company"],           categoria: "servicios_prof", subtipo: "moving" },
  { types: ["architect"],                categoria: "servicios_prof", subtipo: "architect" },
  { types: ["advertising_agency"],       categoria: "servicios_prof", subtipo: "marketing" },
  { types: ["employment_agency"],        categoria: "servicios_prof", subtipo: "employment" },
  { types: ["photographer"],             categoria: "servicios_prof", subtipo: "photographer" },
  { types: ["printing_store"],           categoria: "servicios_prof", subtipo: "printing" },
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
  if (googleTypes.some((t) => t.includes("school") || t.includes("academy"))) {
    return { categoria: "educacion", subtipo: "academy" };
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

async function getDetails(placeId) {
  const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": API_KEY,
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

function formatHours(regularOpeningHours) {
  if (!regularOpeningHours?.weekdayDescriptions?.length) return "";
  return regularOpeningHours.weekdayDescriptions.join(" | ");
}

function formatPriceLevel(priceLevel) {
  if (!priceLevel) return "";
  return priceLevel.replace("PRICE_LEVEL_", "");
}

// ---------------------------------------------------------------------------
// Search queries — 11 queries covering all 10 categories
// ---------------------------------------------------------------------------

const SEARCH_QUERIES = [
  // Existing categories
  "restaurantes bares cafeterias Navalcarnero Madrid",
  "supermercados tiendas alimentacion Navalcarnero Madrid",
  "farmacias clinicas medicos dentistas Navalcarnero Madrid",
  "peluquerias belleza estetica barberia Navalcarnero Madrid",
  "ferreterias muebles ropa tiendas hogar Navalcarnero Madrid",
  "bancos gasolineras lavanderias talleres Navalcarnero Madrid",
  "abogados gestoras inmobiliarias seguros Navalcarnero Madrid",

  // New: Deporte
  "gimnasios deportes padel piscinas boxing Navalcarnero Madrid",

  // New: Ocio y cultura
  "teatro cine museo parque infantil centro cultural ocio Navalcarnero Madrid",

  // New: Educacion
  "colegio academia escuela danza autoescuela idiomas guarderia Navalcarnero Madrid",

  // Extra sweep to catch anything missed
  "servicios locales Navalcarnero Madrid",
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Navalcarnero Vecinal — Google Places fetch script (10 categorias)");
  console.log("=".repeat(65));

  // ── Phase 1: collect unique place IDs ─────────────────────────────────────
  console.log("\nPhase 1 — Text search");
  const rawPlaces = new Map();
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

  // ── Phase 2: fetch full details ────────────────────────────────────────────
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

      if (!lat || !lng) { skipped++; continue; }

      const { categoria, subtipo } = mapGoogleTypes(d.types || []);

      comercios.push({
        id:           `gpl_${googleId}`,
        nombre:       d.displayName?.text || rawPlaces.get(googleId)?.displayName?.text || "",
        categoria,
        subtipo,
        cocina:       [],
        lat,
        lng,
        direccion:    d.formattedAddress        || "",
        telefono:     d.nationalPhoneNumber      || "",
        web:          d.websiteUri               || "",
        horario:      formatHours(d.regularOpeningHours),
        rating:       d.rating                  ?? null,
        totalReviews: d.userRatingCount         ?? null,
        precioNivel:  formatPriceLevel(d.priceLevel),
        tipoDisplay:  d.primaryTypeDisplayName?.text || "",
      });

      await sleep(API_THROTTLE_MS);
    } catch (err) {
      detailErrors++;
      console.error(`  WARN ${googleId}: ${err.message.slice(0, 80)}`);
    }
  }

  console.log(`  Detail calls: ${detailCalls}  |  errors: ${detailErrors}  |  skipped: ${skipped}\n`);

  // ── Phase 3: sort and write ────────────────────────────────────────────────
  comercios.sort((a, b) => {
    if (a.categoria !== b.categoria)
      return a.categoria.localeCompare(b.categoria, "es");
    return a.nombre.localeCompare(b.nombre, "es");
  });

  mkdirSync(dirname(COMERCIOS_PATH), { recursive: true });
  writeFileSync(COMERCIOS_PATH, JSON.stringify(comercios, null, 2) + "\n", "utf-8");

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalCalls = searchCalls + detailCalls;
  console.log("=".repeat(65));
  console.log(`Done!  ${comercios.length} comercios written to src/data/comercios.json`);
  console.log("\nBy category:");
  const byCat = comercios.reduce((acc, c) => {
    acc[c.categoria] = (acc[c.categoria] || 0) + 1; return acc;
  }, {});
  Object.entries(byCat)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, n]) => console.log(`  ${cat.padEnd(22)} ${n}`));

  const withPhone  = comercios.filter(c => c.telefono).length;
  const withWeb    = comercios.filter(c => c.web).length;
  const withHours  = comercios.filter(c => c.horario).length;
  const withRating = comercios.filter(c => c.rating).length;
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
