// Lista canónica de User-Agents a los que se sirve Open Graph enriquecido en
// /eventos/:id. Solo a estos: al resto (navegadores de vecinos) se les devuelve
// el index.html del SPA sin tocar, para no meter una función en el camino
// crítico de una visita normal.
//
// ⚠️ ESTA LISTA ESTÁ DUPLICADA EN vercel.json (rewrites[0].has[0].value), que
// es quien enruta de verdad en producción — vercel.json no puede importar JS.
// Si tocas una, toca la otra; el test de e2e/og-evento comprueba que cuadran.
//
// Son los nombres que estos servicios mandan al pedir la url para
// previsualizarla. Se listan en minúscula y el matching es case-insensitive
// porque varios cambian la capitalización entre versiones (WhatsApp/2.24…).
export const CRAWLERS = [
  'whatsapp',
  'facebookexternalhit',
  'facebookcatalog',
  'twitterbot',
  'slackbot',
  'slack-imgproxy',
  'telegrambot',
  'linkedinbot',
  'discordbot',
  'applebot',
  'googlebot',
  'bingbot',
  'embedly',
  'redditbot',
  'pinterest',
  'vkshare',
  'skypeuripreview',
  'whatsdog',
  'mastodon',
  'bluesky',
  'signal',
]

export const PATRON_CRAWLER = CRAWLERS.join('|')

export function esCrawler(userAgent) {
  if (!userAgent) return false
  return new RegExp(PATRON_CRAWLER, 'i').test(userAgent)
}
