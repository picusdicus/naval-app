/**
 * fetch-comercios-google.mjs
 *
 * Fetches businesses, services, sports, culture and education venues
 * in Navalcarnero from Google Places API (New), normalizes them to the
 * app's data shape, and writes the result to src/data/comercios.json.
 *
 * Además cruza el directorio curado a mano (src/data/servicios-locales.json):
 * busca cada servicio curado en Places por nombre+dirección y, cuando lo
 * confirma, la ficha de Google gana y el curado se retira del fichero (ver
 * "Emparejado con el directorio curado" más abajo).
 *
 * Usage:
 *   node scripts/fetch-comercios-google.mjs
 *   node scripts/fetch-comercios-google.mjs --solo-servicios --limite-servicios=30   # prueba
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
const SERVICIOS_PATH = resolve(ROOT, "src/data/servicios-locales.json");
const OVERRIDES_PATH = resolve(ROOT, "src/data/comercios-overrides.json");
const DUPES_REPORT_PATH = resolve(ROOT, "duplicados-detectados.json");
const ABSORBIDOS_REPORT_PATH = resolve(ROOT, "servicios-absorbidos.json");

// Flags:
//   --dry-run             calcula todo y escribe los informes, pero no toca los JSON de datos
//   --sin-servicios       salta la búsqueda dirigida de los curados (ahorra ~1 llamada por curado)
//   --limite-servicios=N  solo intenta enlazar los N primeros curados (para probar)
//   --solo-servicios      salta las queries genéricas y prueba SOLO el enlace de los curados.
//                         Implica --dry-run: sin la fase 1 el directorio saldría a medias.
const ARGS = process.argv.slice(2);
const SOLO_SERVICIOS = ARGS.includes("--solo-servicios");
const DRY_RUN = ARGS.includes("--dry-run") || SOLO_SERVICIOS;
const SIN_SERVICIOS = ARGS.includes("--sin-servicios") && !SOLO_SERVICIOS;
const LIMITE_SERVICIOS =
  Number(ARGS.find((a) => a.startsWith("--limite-servicios="))?.split("=")[1]) || Infinity;

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
  // ── Prioritarias ──────────────────────────────────────────────────────────
  // Una gasolinera casi siempre lleva también types de cafetería/tienda; si no
  // se evalúa antes que restauración, acaba clasificada como bar (caso Galp).
  { types: ["gas_station"],              categoria: "servicios",      subtipo: "fuel" },

  // ── Alimentacion ──────────────────────────────────────────────────────────
  { types: ["supermarket"],              categoria: "alimentacion",   subtipo: "supermarket" },
  { types: ["asian_grocery_store"],      categoria: "alimentacion",   subtipo: "shop" },
  { types: ["grocery_store"],            categoria: "alimentacion",   subtipo: "supermarket" },
  { types: ["convenience_store"],        categoria: "alimentacion",   subtipo: "convenience" },
  { types: ["bakery"],                   categoria: "alimentacion",   subtipo: "bakery" },
  { types: ["pastry_shop"],              categoria: "alimentacion",   subtipo: "pastry" },
  { types: ["butcher_shop"],             categoria: "alimentacion",   subtipo: "butcher" },
  { types: ["deli"],                     categoria: "alimentacion",   subtipo: "deli" },
  { types: ["greengrocer"],              categoria: "alimentacion",   subtipo: "greengrocer" },
  { types: ["market"],                   categoria: "alimentacion",   subtipo: "marketplace" },
  { types: ["liquor_store"],             categoria: "alimentacion",   subtipo: "alcohol" },
  { types: ["winery"],                   categoria: "alimentacion",   subtipo: "alcohol" },
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
  { types: ["tattoo_parlor"],            categoria: "belleza",        subtipo: "tattoo" },
  { types: ["tanning_studio"],           categoria: "belleza",        subtipo: "beauty" },
  { types: ["skin_care_clinic"],         categoria: "belleza",        subtipo: "beauty" },
  { types: ["makeup_artist"],            categoria: "belleza",        subtipo: "beauty" },

  // ── Hogar ─────────────────────────────────────────────────────────────────
  { types: ["furniture_store"],          categoria: "hogar",          subtipo: "furniture" },
  { types: ["hardware_store"],           categoria: "hogar",          subtipo: "doityourself" },
  { types: ["home_improvement_store"],   categoria: "hogar",          subtipo: "doityourself" },
  { types: ["home_goods_store"],         categoria: "hogar",          subtipo: "houseware" },
  { types: ["florist"],                  categoria: "hogar",          subtipo: "florist" },
  { types: ["garden_center"],            categoria: "hogar",          subtipo: "garden_centre" },
  { types: ["pet_store"],                categoria: "hogar",          subtipo: "pet" },
  { types: ["appliance_store"],          categoria: "hogar",          subtipo: "houseware" },
  { types: ["electronics_store"],        categoria: "hogar",          subtipo: "electronics" },
  { types: ["book_store"],               categoria: "hogar",          subtipo: "books" },
  { types: ["toy_store"],                categoria: "hogar",          subtipo: "toys" },
  { types: ["sporting_goods_store"],     categoria: "hogar",          subtipo: "sports" },

  // ── Moda y complementos ───────────────────────────────────────────────────
  { types: ["clothing_store"],           categoria: "moda",           subtipo: "clothes" },
  { types: ["shoe_store"],               categoria: "moda",           subtipo: "shoes" },
  { types: ["jewelry_store"],            categoria: "moda",           subtipo: "jewelry" },
  { types: ["gift_shop"],                categoria: "hogar",          subtipo: "gift" },
  { types: ["cell_phone_store"],         categoria: "hogar",          subtipo: "electronics" },
  { types: ["bicycle_store"],            categoria: "hogar",          subtipo: "sports" },
  { types: ["department_store"],         categoria: "hogar",          subtipo: "shop" },
  { types: ["pharmacy"],                 categoria: "salud",          subtipo: "pharmacy" }, // already above
  { types: ["chiropractor"],             categoria: "salud",          subtipo: "doctors" },

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
  { types: ["tour_agency"],              categoria: "servicios",      subtipo: "travel_agency" },
  { types: ["library"],                  categoria: "servicios",      subtipo: "library" },
  { types: ["dry_cleaning"],             categoria: "servicios",      subtipo: "dry_cleaning" },
  { types: ["lodging", "hotel"],         categoria: "servicios",      subtipo: "hotel" },
  { types: ["hostel"],                   categoria: "servicios",      subtipo: "hotel" },
  { types: ["parking"],                  categoria: "servicios",      subtipo: "parking" },
  { types: ["storage"],                  categoria: "servicios",      subtipo: "storage" },
  { types: ["courier_service"],          categoria: "servicios",      subtipo: "courier" },
  { types: ["funeral_home"],             categoria: "servicios",      subtipo: "funeral" },
  { types: ["locksmith"],                categoria: "servicios",      subtipo: "locksmith" },
  { types: ["tailor"],                   categoria: "servicios",      subtipo: "tailor" },

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

  // ── Último recurso ────────────────────────────────────────────────────────
  // `food_store` es un type genérico que Google cuelga también de cafeterías,
  // panaderías o veterinarias con tienda: SIEMPRE al final, para que cualquier
  // type específico de arriba gane antes.
  { types: ["food_store"],               categoria: "alimentacion",   subtipo: "shop" },
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
// Cuisine mapping: Google cuisine types → claves de COCINA_LABEL (src/lib/cocinas.js)
// Alimenta los sub-chips "tipo de cocina" del listado de restauración.
// ---------------------------------------------------------------------------

const COCINA_POR_TIPO = {
  hamburger_restaurant:    "burger",
  pizza_restaurant:        "pizza",
  italian_restaurant:      "italian",
  spanish_restaurant:      "spanish",
  tapas_bar:               "tapas",
  chinese_restaurant:      "chinese",
  japanese_restaurant:     "japanese",
  sushi_restaurant:        "sushi",
  ramen_restaurant:        "japanese",
  korean_restaurant:       "asian",
  thai_restaurant:         "asian",
  vietnamese_restaurant:   "asian",
  asian_restaurant:        "asian",
  indian_restaurant:       "indian",
  mexican_restaurant:      "mexican",
  american_restaurant:     "american",
  turkish_restaurant:      "turkish",
  middle_eastern_restaurant: "kebab",
  lebanese_restaurant:     "kebab",
  mediterranean_restaurant: "mediterranean",
  greek_restaurant:        "mediterranean",
  seafood_restaurant:      "seafood",
  steak_house:             "steak_house",
  barbecue_restaurant:     "barbecue",
  fast_food_restaurant:    "fast_food",
  sandwich_shop:           "sandwich",
  breakfast_restaurant:    "breakfast",
  brunch_restaurant:       "breakfast",
  french_restaurant:       "french",
  vegetarian_restaurant:   "vegetarian",
  vegan_restaurant:        "vegan",
  ice_cream_shop:          "ice_cream",
};

function cocinasDe(primaryType = "", googleTypes = []) {
  const set = new Set();
  for (const t of [primaryType, ...googleTypes]) {
    if (COCINA_POR_TIPO[t]) set.add(COCINA_POR_TIPO[t]);
  }
  return [...set];
}

// Segundo pase para los que el mapeo por types deja en el cajón genérico
// (shop/service): se refinan con el primaryTypeDisplayName en español que
// devuelve Google ("Clínica dental", "Fontanero", "Institución educativa"…).
const REFINO_POR_TIPO_DISPLAY = [
  [/instituci[oó]n educativa|centro educativo/i, { categoria: "educacion", subtipo: "school" }],
  [/cl[ií]nica dental|dentista/i,               { categoria: "salud", subtipo: "dentist" }],
  [/cl[ií]nica|centro m[eé]dico|ambulatori/i,   { categoria: "salud", subtipo: "doctors" }],
  [/veterinari/i,                               { categoria: "salud", subtipo: "veterinary" }],
  [/esteticista|est[eé]tica/i,                  { categoria: "belleza", subtipo: "beauty" }],
  [/cuidado de mascotas|peluquer[ií]a canina/i, { categoria: "servicios", subtipo: "pet_care" }],
  [/fontanero/i,                                { categoria: "servicios_prof", subtipo: "plumber" }],
  [/electricista/i,                             { categoria: "servicios_prof", subtipo: "electrician" }],
  [/asesor|consultor|gestor[ií]a/i,             { categoria: "servicios_prof", subtipo: "consultant" }],
  [/contratista/i,                              { categoria: "servicios_prof", subtipo: "builder" }],
  [/cafeter[ií]a/i,                             { categoria: "restauracion", subtipo: "cafe" }],
  [/panader[ií]a/i,                             { categoria: "alimentacion", subtipo: "bakery" }],
];

const SUBTIPOS_GENERICOS = new Set(["shop", "service"]);

// En restauración el type genérico `restaurant` de Google eclipsa a bar/cafe
// (casi todos los locales llevan ambos); el primaryTypeDisplayName en español
// ("Bar", "Cafetería", "Bar restaurante"…) sí distingue el tipo de local.
function subtipoRestauracion(tipoDisplay = "", actual) {
  if (!tipoDisplay) return actual;
  if (/helader/i.test(tipoDisplay)) return "ice_cream";
  if (/cafeter|caf[eé]\b|reposter|pasteler/i.test(tipoDisplay)) return "cafe";
  if (/^bar\b|bar restaurante|cervecer|taberna|pub/i.test(tipoDisplay)) return "bar";
  if (/comida r[aá]pida|pizzer|hamburgues|bocadill|sandwich/i.test(tipoDisplay)) return "fast_food";
  return actual;
}

function refinarGenerico(categoria, subtipo, tipoDisplay) {
  if (!SUBTIPOS_GENERICOS.has(subtipo) || !tipoDisplay) return { categoria, subtipo };
  for (const [re, destino] of REFINO_POR_TIPO_DISPLAY) {
    if (re.test(tipoDisplay)) return { ...destino };
  }
  return { categoria, subtipo };
}

// Los puntos de paquetería (lockers InPost, Punto Pack, GLS…) no llevan un
// type específico de Google y caen al fallback hogar/shop; se detectan por
// nombre y se reclasifican como servicio de paquetería.
const RE_PAQUETERIA = /\b(inpost|punto pack|locker|punto de recogida|parcel|amazon hub|mondial relay|gls|seur pickup|citypaq|pudo)\b/i;

// El locationBias de la búsqueda es orientativo, no un límite: se cuelan
// negocios de Móstoles, Griñón, Arroyomolinos… Se filtra por distancia real.
const MAX_DISTANCIA_KM = 6;

function distanciaKm(lat, lng) {
  const R = 6371;
  const dLat = ((lat - NAVALCARNERO_CENTER.latitude) * Math.PI) / 180;
  const dLng = ((lng - NAVALCARNERO_CENTER.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((NAVALCARNERO_CENTER.latitude * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------------------
// Emparejado con el directorio curado (servicios-locales.json)
// ---------------------------------------------------------------------------
// Los servicios curados (guía municipal) son fichas de contacto a mano: sin
// coordenadas, sin horario y sin web. Muchos SÍ están en Google Places, pero las
// queries genéricas de arriba no los alcanzan (cada búsqueda topa en ~60
// resultados ordenados por prominencia y estos son negocios pequeños), así que
// se buscan uno a uno por nombre + dirección.
//
// Cuando Places confirma uno, la ficha de Google GANA (trae ubicación, horario y
// reseñas) y el curado se BORRA de servicios-locales.json — si no, saldría
// duplicado en el directorio, que concatena las dos fuentes sin dedupe. Lo único
// que se rescata del curado es su categoría/subtipo (la guía clasifica a mano
// donde Places devuelve types genéricos) y los datos de contacto que Google no
// traiga: viajan al override, que se reaplica en cada regeneración.

const sinTildes = (s) => (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const soloTexto = (s) => sinTildes(s).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const PALABRAS_VACIAS = new Set(["de", "la", "el", "los", "las", "y", "del", "navalcarnero", "sl", "slp", "cb", "centro", "tienda", "comercio", "local", "comercial"]);
const tokens = (s) => new Set(soloTexto(s).split(" ").filter((w) => w.length >= 3 && !PALABRAS_VACIAS.has(w)));

const tel = (t) => (t || "").replace(/\D/g, "").replace(/^34/, "");

// Reduce una dirección a { calle: Set(palabras), num }, quitando el tipo de vía
// y los adornos ("local", "bajo") que cada fuente escribe a su manera.
function dirClave(d) {
  let x = soloTexto(d)
    .replace(/\bnavalcarnero\b/g, "")
    .replace(/\blocal\b|\bcomercial\b|\bbajo\b|\bbis\b/g, " ")
    .replace(/\b(calle|c|avenida|avda|av|paseo|plaza|plazuela|pza|ronda|rda|camino|travesia|tr|callejon|carretera|ctra|urbanizacion|urb|pol|poligono|ind)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const num = x.match(/\b(\d{1,4})\b/);
  return { calle: new Set(x.split(" ").filter((w) => w && isNaN(w) && w.length > 2)), num: num ? num[1] : null };
}

const solapa = (a, b) => {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i / Math.min(a.size, b.size);
};

// Similitud de nombres. Con UNA sola palabra en común se divide por el lado más
// largo: si no, "Golden Consultores" casaría al 100 % con "A&R Consultores"
// (comprobado, era un falso positivo real).
function simNombre(a, b) {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i < 2 ? i / Math.max(a.size, b.size) : i / Math.min(a.size, b.size);
}

// Vista uniforme de un candidato, venga de una búsqueda (Place) o del directorio
// ya montado (comercio).
const fichaDePlace = (p) => ({
  nombre: p.displayName?.text || "",
  direccion: p.shortFormattedAddress || p.formattedAddress || "",
  telefono: p.nationalPhoneNumber || "",
});

// ¿Los dos nombres tienen algo que ver? Tolerante con la grafía, porque la guía
// separa lo que Google junta y al revés: "Luz y Led" ↔ "LuzyLed",
// "Centro Casa Verde" ↔ "Centro Casaverde", "20 Bikes" ↔ "20Bikes".
function nombresEmparentados(a, b) {
  const ja = soloTexto(a).replace(/ /g, "");
  const jb = soloTexto(b).replace(/ /g, "");
  if (!ja || !jb) return false;
  if (ja.includes(jb) || jb.includes(ja)) return true;
  // Solo palabras de ≥4 letras: con 3 se cuela ruido dentro de otras palabras
  // ("All **for** Printing" contra "Af**for**d Industrial", que son dos empresas).
  for (const t of tokens(a)) if (t.length >= 4 && jb.includes(t)) return true;
  for (const t of tokens(b)) if (t.length >= 4 && ja.includes(t)) return true;
  return false;
}

// Confianza de que un curado y un candidato de Google sean el MISMO negocio:
//   3 = casi seguro   2 = fuerte (se absorbe)   1 = dudoso (a revisar a mano)   0 = nada
function confianzaEnlace(servicio, ficha) {
  const nombreSim = simNombre(tokens(servicio.nombre), tokens(ficha.nombre));
  const ka = dirClave(servicio.direccion);
  const kb = dirClave(ficha.direccion);
  const calleSim = solapa(ka.calle, kb.calle);
  const numIgual = !!(ka.num && kb.num && ka.num === kb.num);
  const ta = tel(servicio.telefono);
  const tb = tel(ficha.telefono);
  const telIgual = !!(ta && ta === tb);
  const telDistinto = !!(ta && tb && ta !== tb);

  if (telIgual && nombreSim >= 0.45) return { conf: 3, motivo: "teléfono idéntico" };
  if (nombreSim >= 0.6 && calleSim >= 0.5 && numIgual) return { conf: 3, motivo: "mismo nombre y misma dirección" };
  // El teléfono solo no basta si los nombres no tienen NADA que ver: un mismo
  // número cubre a veces dos negocios del mismo dueño (una perfumería y una
  // administración de lotería, una cafetería y una empresa de climatización), y
  // absorber ahí borra uno de los dos del directorio y encima le pega su
  // categoría al otro. Comprobado en la primera regeneración: 2 de 30 casos.
  if (telIgual) {
    return nombresEmparentados(servicio.nombre, ficha.nombre)
      ? { conf: 2, motivo: "mismo teléfono, mismo rótulo escrito de otra forma" }
      : { conf: 1, motivo: "mismo teléfono pero nombres sin relación (¿dos negocios del mismo dueño?)" };
  }
  // Dos teléfonos distintos son la señal más fuerte de que son negocios
  // diferentes (vecinos de portal, mismo gremio en la misma calle): sin dirección
  // exacta que lo respalde no se absorbe, se manda a revisión.
  if (telDistinto) {
    return nombreSim >= 0.75 && calleSim >= 0.5
      ? { conf: 1, motivo: "nombre y calle coinciden, pero el teléfono no" }
      : { conf: 0, motivo: null };
  }
  if (nombreSim >= 0.75 && calleSim >= 0.5) return { conf: 2, motivo: "mismo nombre y misma calle" };
  if (nombreSim >= 0.9 && numIgual) return { conf: 2, motivo: "mismo nombre y mismo número" };
  if (nombreSim >= 0.9) return { conf: 1, motivo: "mismo nombre, dirección sin contrastar" };
  return { conf: 0, motivo: null };
}

// ---------------------------------------------------------------------------
// Google Places API (New) wrappers
// ---------------------------------------------------------------------------

const PLACES_BASE = "https://places.googleapis.com/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchText(query, pageToken = null, maxResultCount = 20) {
  const body = {
    textQuery: query,
    locationBias: {
      circle: { center: NAVALCARNERO_CENTER, radius: SEARCH_RADIUS_METERS },
    },
    maxResultCount,
    languageCode: "es",
  };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      // `nationalPhoneNumber` no lo usa el directorio (el detalle lo trae igual):
      // está aquí porque es el criterio con el que se reconoce a un servicio
      // curado, y sin él el emparejado de la fase 1b se queda ciego justo donde
      // más falta hace (rótulo distinto del nombre de la guía: "Frusangar" ↔
      // "Patatas Frusangar", puestos del mercado dados de alta a nombre del dueño).
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.types,places.location," +
        "places.formattedAddress,places.nationalPhoneNumber,nextPageToken",
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
        "id,displayName,types,primaryType,location,formattedAddress," +
        "shortFormattedAddress,googleMapsUri,businessStatus," +
        "nationalPhoneNumber,websiteUri,regularOpeningHours," +
        "rating,userRatingCount,priceLevel,primaryTypeDisplayName," +
        "editorialSummary,outdoorSeating,takeout,delivery,reservable," +
        "servesVegetarianFood,accessibilityOptions,paymentOptions",
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

  // Verticales de nicho: las queries genéricas de arriba saturan el cupo de
  // ~60 resultados por búsqueda y estos gremios nunca aparecían.
  "joyerias relojerias Navalcarnero Madrid",
  "tatuajes piercing Navalcarnero Madrid",
  "opticas ortopedias herbolarios Navalcarnero Madrid",
  "librerias papelerias jugueterias Navalcarnero Madrid",
  "estancos loterias kioscos prensa Navalcarnero Madrid",
  "cerrajerias copisterias reparacion moviles informatica Navalcarnero Madrid",
  "veterinarios peluqueria canina tiendas mascotas Navalcarnero Madrid",
  "floristerias viveros plantas Navalcarnero Madrid",
  "bazares tiendas regalos decoracion Navalcarnero Madrid",
  "talleres coche neumaticos chapa pintura Navalcarnero Madrid",
  "tiendas ropa zapaterias moda complementos Navalcarnero Madrid",
  "fisioterapia podologia psicologia clinica Navalcarnero Madrid",
  "fotografos imprentas agencias de viajes Navalcarnero Madrid",
  "punto de recogida paquetes locker InPost GLS SEUR Mondial Relay Navalcarnero Madrid",

  // Extra sweep to catch anything missed
  "servicios locales Navalcarnero Madrid",
];

// ---------------------------------------------------------------------------
// Búsqueda dirigida de los servicios curados
// ---------------------------------------------------------------------------
// Una búsqueda por curado, con su nombre y su dirección. Los que ya haya traído
// la fase 1 no gastan llamada. Los ids resueltos se suman a `rawPlaces` para que
// la fase 2 les pida el detalle completo como a cualquier otro.
async function enlazarServiciosCurados(rawPlaces, servicios) {
  const enlaces = new Map(); // servicioId → { placeId, conf, motivo, via }
  const stats = { llamadas: 0, yaEstaban: 0, nuevos: 0, sinEnlace: 0, errores: 0 };

  const lista = servicios.slice(0, LIMITE_SERVICIOS);
  for (let i = 0; i < lista.length; i++) {
    const s = lista[i];
    if (i % 25 === 0) console.log(`  [${i + 1}/${lista.length}]`);

    // 1) ¿Lo trajo ya alguna query genérica? (gratis)
    let mejor = null;
    for (const p of rawPlaces.values()) {
      const { conf, motivo } = confianzaEnlace(s, fichaDePlace(p));
      if (conf >= 2 && (!mejor || conf > mejor.conf)) {
        mejor = { placeId: p.id, conf, motivo, via: "búsqueda genérica" };
      }
    }
    if (mejor) {
      enlaces.set(s.id, mejor);
      stats.yaEstaban++;
      continue;
    }

    // 2) Búsqueda dirigida.
    let place = null;
    try {
      const { places } = await searchText(`${s.nombre}, ${s.direccion || "Navalcarnero"}`, null, 5);
      stats.llamadas++;
      for (const p of places) {
        const lat = p.location?.latitude ?? 0;
        const lng = p.location?.longitude ?? 0;
        if (!lat || !lng || distanciaKm(lat, lng) > MAX_DISTANCIA_KM) continue;
        const { conf, motivo } = confianzaEnlace(s, fichaDePlace(p));
        if (conf >= 2 && (!mejor || conf > mejor.conf)) {
          mejor = { placeId: p.id, conf, motivo, via: "búsqueda dirigida" };
          place = p;
        }
      }
    } catch (err) {
      stats.errores++;
      console.error(`  WARN ${s.nombre}: ${err.message.slice(0, 80)}`);
    }

    if (mejor) {
      if (!rawPlaces.has(mejor.placeId)) {
        rawPlaces.set(mejor.placeId, place);
        stats.nuevos++;
      }
      enlaces.set(s.id, mejor);
    } else {
      stats.sinEnlace++;
    }
    await sleep(API_THROTTLE_MS);
  }

  return { enlaces, stats };
}

// ---------------------------------------------------------------------------
// Absorción: el curado que Google ya cubre sale de servicios-locales.json
// ---------------------------------------------------------------------------
// Se re-verifica con el detalle completo (ahora sí hay teléfono, que es el
// criterio fuerte). Solo se absorbe con confianza ≥ 2; lo dudoso se queda y va
// al informe para mirarlo a mano.
function absorberCurados(final, servicios, enlaces, overrides) {
  const porId = new Map(final.map((c) => [c.id, c]));
  const absorbidos = [];
  const revisar = [];
  const restantes = [];

  for (const s of servicios) {
    const candidatos = [];
    const enlace = enlaces.get(s.id);
    if (enlace) {
      const c = porId.get(`gpl_${enlace.placeId}`);
      if (c) candidatos.push(c); // si no sobrevivió (cerrado, lejano, excluido) no se absorbe
    }
    // El teléfono solo se conoce tras el detalle, así que aquí se pillan también
    // los duplicados que ya venían de las queries genéricas sin enlazar.
    const t = tel(s.telefono);
    if (t) for (const c of final) if (tel(c.telefono) === t && !candidatos.includes(c)) candidatos.push(c);

    let mejor = null;
    for (const c of candidatos) {
      const { conf, motivo } = confianzaEnlace(s, c);
      if (conf > 0 && (!mejor || conf > mejor.conf)) mejor = { conf, motivo, comercio: c };
    }

    if (mejor && mejor.conf >= 2) {
      trasladarCurado(s, mejor.comercio, overrides);
      absorbidos.push({
        confianza: mejor.conf,
        motivo: mejor.motivo,
        via: enlace?.via || "coincidencia por teléfono",
        servicioId: s.id,
        servicioNombre: s.nombre,
        servicioDireccion: s.direccion || "",
        comercioId: mejor.comercio.id,
        comercioNombre: mejor.comercio.nombre,
        comercioDireccion: mejor.comercio.direccion || "",
      });
    } else {
      restantes.push(s);
      if (mejor) {
        revisar.push({
          confianza: mejor.conf,
          motivo: mejor.motivo,
          servicioId: s.id,
          servicioNombre: s.nombre,
          servicioDireccion: s.direccion || "",
          comercioId: mejor.comercio.id,
          comercioNombre: mejor.comercio.nombre,
          comercioDireccion: mejor.comercio.direccion || "",
        });
      }
    }
  }

  return { absorbidos, revisar, restantes };
}

// La ficha de Google gana en datos pero pierde en taxonomía: la guía municipal
// clasifica a mano ("frutas_y_verduras", "comida_preparada") donde Places
// devuelve types genéricos. Lo curado que merece sobrevivir viaja al override,
// que es lo único que se reaplica en las próximas regeneraciones (el curado se
// borra). Un override previo del panel superadmin manda sobre la guía.
function trasladarCurado(servicio, comercio, overrides) {
  const override = { ...(overrides[comercio.id] || {}) };

  if (!override.categoria) {
    comercio.categoria = servicio.categoria;
    comercio.subtipo = servicio.subtipo;
    override.categoria = servicio.categoria;
    override.subtipo = servicio.subtipo;
  }
  // Contacto: solo se rellenan huecos de Google, nunca se pisa lo que trae.
  for (const campo of ["telefono", "web", "direccion"]) {
    if (!comercio[campo] && servicio[campo]) {
      comercio[campo] = servicio[campo];
      override[campo] = servicio[campo];
    }
  }

  overrides[comercio.id] = override;
}

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

  for (const query of SOLO_SERVICIOS ? [] : SEARCH_QUERIES) {
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

  // ── Phase 1b: búsqueda dirigida de los servicios curados ──────────────────
  const servicios = leerServicios();
  let enlaces = new Map();
  if (SIN_SERVICIOS || !servicios.length) {
    console.log("Phase 1b — Servicios curados: saltada\n");
  } else {
    console.log(`Phase 1b — Servicios curados (${Math.min(servicios.length, LIMITE_SERVICIOS)} de ${servicios.length})`);
    const r = await enlazarServiciosCurados(rawPlaces, servicios);
    enlaces = r.enlaces;
    searchCalls += r.stats.llamadas;
    console.log(
      `  Enlazados: ${enlaces.size}  (${r.stats.yaEstaban} ya estaban en los resultados, ${r.stats.nuevos} nuevos)` +
        `  |  sin enlace: ${r.stats.sinEnlace}  |  llamadas: ${r.stats.llamadas}  |  errores: ${r.stats.errores}\n`,
    );
  }

  // ── Phase 2: fetch full details ────────────────────────────────────────────
  console.log("Phase 2 — Place details");
  const comercios = [];
  let detailCalls = 0;
  let detailErrors = 0;
  let skipped = 0;
  let cerrados = 0;
  let lejanos = 0;
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

      // Un negocio cerrado definitivamente no debe entrar en el directorio.
      if (d.businessStatus === "CLOSED_PERMANENTLY") { cerrados++; continue; }

      // Fuera del municipio (el locationBias no es un límite duro).
      if (distanciaKm(lat, lng) > MAX_DISTANCIA_KM) { lejanos++; continue; }

      let { categoria, subtipo } = mapGoogleTypes(d.types || []);
      ({ categoria, subtipo } = refinarGenerico(categoria, subtipo, d.primaryTypeDisplayName?.text));
      if (categoria === "restauracion") {
        subtipo = subtipoRestauracion(d.primaryTypeDisplayName?.text, subtipo);
      }

      const nombrePlace = d.displayName?.text || "";
      if (RE_PAQUETERIA.test(nombrePlace)) {
        categoria = "servicios";
        subtipo = "courier";
      }

      // Atributos prácticos (solo se guardan los afirmativos, el JSON no crece).
      const atributos = {};
      if (d.outdoorSeating) atributos.terraza = true;
      if (d.takeout) atributos.paraLlevar = true;
      if (d.delivery) atributos.aDomicilio = true;
      if (d.reservable) atributos.reservas = true;
      if (d.servesVegetarianFood) atributos.vegetariano = true;
      if (d.accessibilityOptions?.wheelchairAccessibleEntrance) atributos.accesible = true;
      if (d.paymentOptions?.acceptsCashOnly) atributos.soloEfectivo = true;
      else if (d.paymentOptions?.acceptsCreditCards) atributos.tarjeta = true;

      comercios.push({
        id:           `gpl_${googleId}`,
        nombre:       d.displayName?.text || rawPlaces.get(googleId)?.displayName?.text || "",
        categoria,
        subtipo,
        cocina:       categoria === "restauracion" ? cocinasDe(d.primaryType, d.types) : [],
        lat,
        lng,
        direccion:    d.shortFormattedAddress    || d.formattedAddress || "",
        telefono:     d.nationalPhoneNumber      || "",
        web:          d.websiteUri               || "",
        mapsUrl:      d.googleMapsUri            || "",
        horario:      formatHours(d.regularOpeningHours),
        rating:       d.rating                  ?? null,
        totalReviews: d.userRatingCount         ?? null,
        precioNivel:  formatPriceLevel(d.priceLevel),
        tipoDisplay:  d.primaryTypeDisplayName?.text || "",
        descripcion:  d.editorialSummary?.text   || "",
        cerradoTemporal: d.businessStatus === "CLOSED_TEMPORARILY",
        atributos,
      });

      await sleep(API_THROTTLE_MS);
    } catch (err) {
      detailErrors++;
      console.error(`  WARN ${googleId}: ${err.message.slice(0, 80)}`);
    }
  }

  console.log(`  Detail calls: ${detailCalls}  |  errors: ${detailErrors}  |  skipped: ${skipped}  |  cerrados definitivos: ${cerrados}  |  fuera del municipio: ${lejanos}\n`);

  // ── Phase 3: overrides curados ─────────────────────────────────────────────
  // src/data/comercios-overrides.json corrige clasificaciones que Google trae
  // mal (keyed por id; `"excluir": true` saca el local del directorio).
  const overrides = leerOverrides();
  const overridesAntes = JSON.stringify(overrides);
  let final = comercios.filter((c) => !overrides[c.id]?.excluir);
  let aplicados = 0;
  for (const c of final) {
    if (overrides[c.id]) { Object.assign(c, overrides[c.id]); aplicados++; }
  }
  console.log(`  Overrides: ${aplicados} aplicados, ${comercios.length - final.length} excluidos\n`);

  // ── Phase 4: absorber los curados que Google ya cubre ──────────────────────
  const { absorbidos, revisar, restantes } = absorberCurados(final, servicios, enlaces, overrides);
  if (servicios.length) {
    console.log(
      `Phase 4 — Servicios curados absorbidos: ${absorbidos.length}` +
        `  |  siguen curados: ${restantes.length}  |  dudosos a revisar: ${revisar.length}\n`,
    );
  }

  final.sort((a, b) => {
    if (a.categoria !== b.categoria)
      return a.categoria.localeCompare(b.categoria, "es");
    return a.nombre.localeCompare(b.nombre, "es");
  });

  if (DRY_RUN) {
    console.log("  DRY RUN — no se escribe ningún JSON de datos (solo los informes).\n");
  } else {
    mkdirSync(dirname(COMERCIOS_PATH), { recursive: true });
    writeFileSync(COMERCIOS_PATH, JSON.stringify(final, null, 2) + "\n", "utf-8");

    // El curado absorbido desaparece de servicios-locales.json: si se quedara,
    // el directorio (que concatena las dos fuentes) lo pintaría dos veces.
    if (absorbidos.length) {
      writeFileSync(SERVICIOS_PATH, JSON.stringify(restantes, null, 2) + "\n", "utf-8");
      console.log(`  servicios-locales.json: ${absorbidos.length} entradas retiradas (quedan ${restantes.length})`);
    }
    if (JSON.stringify(overrides) !== overridesAntes) {
      writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2) + "\n", "utf-8");
      console.log(`  comercios-overrides.json: taxonomía curada trasladada`);
    }
  }

  if (absorbidos.length) {
    writeFileSync(ABSORBIDOS_REPORT_PATH, JSON.stringify(absorbidos, null, 2) + "\n", "utf-8");
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalCalls = searchCalls + detailCalls;
  console.log("=".repeat(65));
  console.log(`Done!  ${final.length} comercios written to src/data/comercios.json`);
  console.log("\nBy category:");
  const byCat = final.reduce((acc, c) => {
    acc[c.categoria] = (acc[c.categoria] || 0) + 1; return acc;
  }, {});
  Object.entries(byCat)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, n]) => console.log(`  ${cat.padEnd(22)} ${n}`));

  const withPhone  = final.filter(c => c.telefono).length;
  const withWeb    = final.filter(c => c.web).length;
  const withHours  = final.filter(c => c.horario).length;
  const withRating = final.filter(c => c.rating).length;
  const withCocina = final.filter(c => c.cocina?.length).length;
  const withDesc   = final.filter(c => c.descripcion).length;
  const withAttrs  = final.filter(c => c.atributos && Object.keys(c.atributos).length).length;
  console.log("\nField coverage:");
  console.log(`  telefono     ${withPhone}/${final.length}`);
  console.log(`  web          ${withWeb}/${final.length}`);
  console.log(`  horario      ${withHours}/${final.length}`);
  console.log(`  rating       ${withRating}/${final.length}`);
  console.log(`  cocina       ${withCocina}/${final.length}`);
  console.log(`  descripcion  ${withDesc}/${final.length}`);
  console.log(`  atributos    ${withAttrs}/${final.length}`);

  console.log(`\nAPI calls used: ${totalCalls}  (~$${(totalCalls * 0.017).toFixed(2)})`);
  console.log(`  ${searchCalls} search  +  ${detailCalls} detail`);

  informarServicios(absorbidos, revisar, restantes);
}

// ---------------------------------------------------------------------------
// Lectura de los ficheros curados
// ---------------------------------------------------------------------------

function leerServicios() {
  if (!existsSync(SERVICIOS_PATH)) return [];
  try { return JSON.parse(readFileSync(SERVICIOS_PATH, "utf-8")); }
  catch { return []; }
}

function leerOverrides() {
  if (!existsSync(OVERRIDES_PATH)) return {};
  try { return JSON.parse(readFileSync(OVERRIDES_PATH, "utf-8")); }
  catch { return {}; }
}

// ---------------------------------------------------------------------------
// Informe final sobre los servicios curados
// ---------------------------------------------------------------------------
// Dos listas: los absorbidos (Google los cubre y ya han salido del fichero
// curado, con rastro en servicios-absorbidos.json para poder deshacerlo con git)
// y los dudosos, que NO se tocan y van a duplicados-detectados.json para mirarlos
// a mano — típicamente mismo nombre y calle con teléfonos distintos, que en un
// pueblo puede ser el mismo negocio con el teléfono viejo o dos negocios vecinos.
function informarServicios(absorbidos, revisar, restantes) {
  if (!absorbidos.length && !revisar.length) return;

  console.log("\n" + "=".repeat(65));

  if (absorbidos.length) {
    console.log(`✓ ${absorbidos.length} servicio(s) curado(s) absorbido(s) por Google Places:`);
    for (const d of [...absorbidos].sort((a, b) => b.confianza - a.confianza)) {
      console.log(`  • ${d.servicioNombre} (${d.servicioId})`);
      console.log(`      → ${d.comercioNombre} (${d.comercioId})`);
      console.log(`      ${d.motivo} · ${d.via}`);
    }
    console.log(`\n  Quedan ${restantes.length} servicios curados (no están en Places).`);
    console.log("  Rastro en servicios-absorbidos.json; para deshacer, git checkout de los JSON.");
  }

  if (revisar.length) {
    revisar.sort((a, b) => b.confianza - a.confianza);
    console.log(`\n⚠ ${revisar.length} pareja(s) dudosa(s) — NO se han tocado:`);
    for (const d of revisar) {
      console.log(`  • ${d.servicioNombre} (${d.servicioId})`);
      console.log(`      ↔ ${d.comercioNombre} (${d.comercioId})`);
      console.log(`      ${d.motivo}`);
    }
    writeFileSync(DUPES_REPORT_PATH, JSON.stringify(revisar, null, 2) + "\n", "utf-8");
    console.log("\n  Reporte en duplicados-detectados.json (revísalo a mano).");
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
