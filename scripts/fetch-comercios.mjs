/**
 * fetch-comercios-google.mjs
 *
 * Fetches businesses in Navalcarnero from Google Places API (New),
 * normalizes them to the same shape used by the OSM script,
 * merges with the existing comercios.json (deduplication by proximity + name),
 * and writes the result back to src/data/comercios.json.
 *
 * Usage:
 *   node scripts/fetch-comercios-google.mjs
 *
 * Requires:
 *   GOOGLE_PLACES_KEY in .env.local (or already in process.env)
 *
 * Merge strategy:
 *   - OSM entries are always kept as-is (source of truth for coordinates).
 *   - A Google result is considered a DUPLICATE of an OSM entry when:
 *       distance <= DEDUP_DISTANCE_METERS  AND  nameSimilarity >= DEDUP_NAME_THRESHOLD
 *   - On match: OSM entry is ENRICHED with Google's phone/web/hours (only if empty).
 *   - No match: Google entry is ADDED with id prefix "gpl_".
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
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

loadEnvLocal();

const API_KEY = process.env.GOOGLE_PLACES_KEY;
if (!API_KEY) {
  console.error("ERROR: GOOGLE_PLACES_KEY not found. Add it to .env.local");
  process.exit(1);
}

const COMERCIOS_PATH = resolve(ROOT, "src/data/comercios.json");

const DEDUP_DISTANCE_METERS = 50;
const DEDUP_NAME_THRESHOLD = 0.6;
const NAVALCARNERO_CENTER = { latitude: 40.2817, longitude: -4.0108 };
const SEARCH_RADIUS_METERS = 4500;
const API_THROTTLE_MS = 220;

const CATEGORY_RULES = [
  { types: ["supermarket"],             categoria: "alimentacion",   subtipo: "supermarket" },
  { types: ["grocery_store"],           categoria: "alimentacion",   subtipo: "supermarket" },
  { types: ["convenience_store"],       categoria: "alimentacion",   subtipo: "convenience" },
  { types: ["bakery"],                  categoria: "alimentacion",   subtipo: "bakery" },
  { types: ["butcher_shop"],            categoria: "alimentacion",   subtipo: "butcher" },
  { types: ["deli"],                    categoria: "alimentacion",   subtipo: "deli" },
  { types: ["greengrocer"],             categoria: "alimentacion",   subtipo: "greengrocer" },
  { types: ["market"],                  categoria: "alimentacion",   subtipo: "marketplace" },
  { types: ["liquor_store"],            categoria: "alimentacion",   subtipo: "alcohol" },
  { types: ["restaurant"],              categoria: "restauracion",   subtipo: "restaurant" },
  { types: ["cafe", "coffee_shop"],     categoria: "restauracion",   subtipo: "cafe" },
  { types: ["bar"],                     categoria: "restauracion",   subtipo: "bar" },
  { types: ["fast_food_restaurant"],    categoria: "restauracion",   subtipo: "fast_food" },
  { types: ["pizza_restaurant"],        categoria: "restauracion",   subtipo: "pizza" },
  { types: ["sandwich_shop"],           categoria: "restauracion",   subtipo: "sandwich" },
  { types: ["ice_cream_shop"],          categoria: "restauracion",   subtipo: "ice_cream" },
  { types: ["dessert_shop"],            categoria: "restauracion",   subtipo: "pastry" },
  { types: ["meal_takeaway"],           categoria: "restauracion",   subtipo: "fast_food" },
  { types: ["pharmacy"],                categoria: "salud",          subtipo: "pharmacy" },
  { types: ["hospital"],                categoria: "salud",          subtipo: "hospital" },
  { types: ["doctor"],                  categoria: "salud",          subtipo: "doctors" },
  { types: ["dentist"],                 categoria: "salud",          subtipo: "dentist" },
  { types: ["physiotherapist"],         categoria: "salud",          subtipo: "physiotherapist" },
  { types: ["optician"],                categoria: "salud",          subtipo: "optician" },
  { types: ["veterinary_care"],         categoria: "salud",          subtipo: "veterinary" },
  { types: ["hair_salon", "hair_care"], categoria: "belleza",        subtipo: "hairdresser" },
  { types: ["beauty_salon"],            categoria: "belleza",        subtipo: "beauty" },
  { types: ["nail_salon"],              categoria: "belleza",        subtipo: "beauty" },
  { types: ["barber_shop"],             categoria: "belleza",        subtipo: "barber" },
  { types: ["spa"],                     categoria: "belleza",        subtipo: "beauty" },
  { types: ["furniture_store"],         categoria: "hogar",          subtipo: "furniture" },
  { types: ["hardware_store"],          categoria: "hogar",          subtipo: "doityourself" },
  { types: ["home_goods_store"],        categoria: "hogar",          subtipo: "houseware" },
  { types: ["florist"],                 categoria: "hogar",          subtipo: "florist" },
  { types: ["garden_center"],           categoria: "hogar",          subtipo: "garden_centre" },
  { types: ["pet_store"],               categoria: "hogar",          subtipo: "pet" },
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
        "nationalPhoneNumber,websiteUri,regularOpeningHours",
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

function distanceMeters(a, b) {
  const R = 6_371_000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const c =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function nameSimilarity(a, b) {
  const norm = (s) =>
    s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, "").trim();
  const s = norm(a);
  const t = norm(b);
  if (s === t) return 1;
  if (!s || !t) return 0;
  const m = s.length, n = t.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = s[i-1] === t[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[m][n] / Math.max(m, n);
}

function findOsmMatch(googlePlace, osmEntries) {
  for (const osm of osmEntries) {
    if (typeof osm.lat !== "number" || typeof osm.lng !== "number") continue;
    if (distanceMeters(osm, googlePlace) > DEDUP_DISTANCE_METERS) continue;
    if (nameSimilarity(osm.nombre, googlePlace.nombre) < DEDUP_NAME_THRESHOLD) continue;
    return osm;
  }
  return null;
}

function enrichFromGoogle(osmEntry, googlePlace) {
  if (!osmEntry.telefono  && googlePlace.telefono)  osmEntry.telefono  = googlePlace.telefono;
  if (!osmEntry.web       && googlePlace.web)        osmEntry.web       = googlePlace.web;
  if (!osmEntry.horario   && googlePlace.horario)    osmEntry.horario   = googlePlace.horario;
  if (!osmEntry.direccion && googlePlace.direccion)  osmEntry.direccion = googlePlace.direccion;
}

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

async function main() {
  console.log("Navalcarnero Vecinal — Google Places merge script");
  console.log("=".repeat(55));

  let existingEntries = [];
  if (existsSync(COMERCIOS_PATH)) {
    existingEntries = JSON.parse(readFileSync(COMERCIOS_PATH, "utf-8"));
    console.log(`Loaded ${existingEntries.length} existing entries from comercios.json`);
  } else {
    console.log("comercios.json not found — will create from scratch");
  }

  const osmEntries    = existingEntries.filter((c) => !c.id.startsWith("gpl_"));
  const prevGoogleMap = new Map(
    existingEntries.filter((c) => c.id.startsWith("gpl_")).map((c) => [c.id, c])
  );
  console.log(`  OSM entries:    ${osmEntries.length}`);
  console.log(`  Google entries: ${prevGoogleMap.size}\n`);

  console.log("Phase 1 — Text search");
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

  console.log(`\n  Total unique places: ${rawPlaces.size}`);
  console.log(`  Search calls: ${searchCalls}\n`);

  console.log("Phase 2 — Place details");
  const googleComerciosFull = [];
  let detailCalls = 0;
  let detailErrors = 0;
  const ids = Array.from(rawPlaces.keys());

  for (let i = 0; i < ids.length; i++) {
    const googleId = ids[i];
    if (i % 25 === 0) console.log(`  [${i + 1}/${ids.length}]`);

    try {
      const d = await getDetails(googleId);
      detailCalls++;
      const { categoria, subtipo } = mapGoogleTypes(d.types || []);

      googleComerciosFull.push({
        _googleId: googleId,
        id: `gpl_${googleId}`,
        nombre:    d.displayName?.text || rawPlaces.get(googleId)?.displayName?.text || "",
        categoria,
        subtipo,
        cocina:    [],
        lat:       d.location?.latitude  ?? 0,
        lng:       d.location?.longitude ?? 0,
        direccion: d.formattedAddress || "",
        telefono:  d.nationalPhoneNumber || "",
        web:       d.websiteUri || "",
        horario:   formatHours(d.regularOpeningHours),
      });

      await sleep(API_THROTTLE_MS);
    } catch (err) {
      detailErrors++;
      console.error(`  WARN ${googleId}: ${err.message.slice(0, 80)}`);
    }
  }

  console.log(`  Detail calls: ${detailCalls}  |  errors: ${detailErrors}\n`);

  console.log("Phase 3 — Merge");
  const mergedOsmEntries = osmEntries.map((e) => ({ ...e }));
  const newGoogleEntries = [];
  let enrichedCount = 0;
  let addedCount    = 0;
  let skippedCount  = 0;

  for (const gp of googleComerciosFull) {
    if (!gp.lat || !gp.lng) { skippedCount++; continue; }

    const osmMatch = findOsmMatch(gp, mergedOsmEntries);

    if (osmMatch) {
      enrichFromGoogle(osmMatch, gp);
      enrichedCount++;
    } else {
      const existing = prevGoogleMap.get(gp.id);
      newGoogleEntries.push(existing ? { ...existing, ...gp } : gp);
      if (!existing) addedCount++;
    }
  }

  console.log(`  OSM entries enriched with Google data: ${enrichedCount}`);
  console.log(`  New Google-only entries added:         ${addedCount}`);
  console.log(`  Skipped (no coordinates):              ${skippedCount}`);

  const output = [...mergedOsmEntries, ...newGoogleEntries]
    .map(({ _googleId, ...rest }) => rest)
    .sort((a, b) => {
      if (a.categoria !== b.categoria)
        return a.categoria.localeCompare(b.categoria, "es");
      return a.nombre.localeCompare(b.nombre, "es");
    });

  writeFileSync(COMERCIOS_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");

  const totalCalls = searchCalls + detailCalls;
  console.log("\n" + "=".repeat(55));
  console.log(`Done!  ${output.length} total comercios written to comercios.json`);
  console.log("\nBy category:");
  const byCat = output.reduce((acc, c) => {
    acc[c.categoria] = (acc[c.categoria] || 0) + 1; return acc;
  }, {});
  Object.entries(byCat)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, n]) => console.log(`  ${cat.padEnd(22)} ${n}`));
  console.log(`\nAPI calls used: ${totalCalls}  (~$${(totalCalls * 0.017).toFixed(2)})`);
  console.log(`  ${searchCalls} search  +  ${detailCalls} detail`);
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});