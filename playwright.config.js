import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, PUERTO } from './e2e/entorno.js'

// Los tests atacan el servidor de desarrollo real (Vite + los handlers de api/),
// contra la base de datos Neon y el store de Vercel Blob de verdad. No hay
// mocks: si la subida de imágenes se rompe, estos tests se caen.
// Specs agrupados por la sesión que necesitan. El grupo decide de qué proyecto
// de setup depende cada uno, y eso acota el radio de un fallo: si caducan las
// credenciales de la organización, sus tres specs se quedan sin correr y los
// del superadmin siguen dando señal (con un único setup para los dos tiers, un
// login roto dejaba la suite entera sin ejecutar).
const SPECS_SUPER = ['admin-super', 'destacados-super', 'deportes-revision', 'fusiones-eventos']
const SPECS_ORG = ['destacar-evento', 'imagen-evento', 'perfil-organizacion']

const soloEstos = (nombres) => new RegExp(`(${nombres.join('|')})\\.spec\\.js$`)
// Lo que no necesita sesión (navbar, reclamaciones) no depende de ningún
// setup: un login roto no debe impedir que se comprueben las páginas públicas.
const niEstos = (nombres) => new RegExp(`^(?!.*(${nombres.join('|')})\\.spec\\.js$).*\\.spec\\.(js|mjs)$`)

function proyectos() {
  const viewports = [
    ['escritorio', devices['Desktop Chrome']],
    ['movil', devices['Pixel 5']],
  ]
  return [
    // El sufijo `.setup.js` queda fuera del testMatch por defecto, así que los
    // proyectos de abajo no los ejecutan además como test suelto.
    { name: 'setup-super', testMatch: /sesion-super\.setup\.js$/ },
    { name: 'setup-org', testMatch: /sesion-org\.setup\.js$/ },
    ...viewports.flatMap(([nombre, device]) => [
      {
        name: `${nombre}-publico`,
        use: { ...device },
        testMatch: niEstos([...SPECS_SUPER, ...SPECS_ORG]),
      },
      {
        name: `${nombre}-super`,
        use: { ...device },
        testMatch: soloEstos(SPECS_SUPER),
        dependencies: ['setup-super'],
      },
      {
        name: `${nombre}-org`,
        use: { ...device },
        testMatch: soloEstos(SPECS_ORG),
        dependencies: ['setup-org'],
      },
    ]),
  ]
}

export default defineConfig({
  testDir: './e2e',
  // Un solo worker: los tests comparten la organización y la base de datos.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: proyectos(),

  webServer: {
    command: `npm run dev -- --port ${PUERTO} --strictPort`,
    // Los tests atacan servicios reales y limpian lo que crean en Neon y en
    // Blob, pero un email enviado no se deshace: `validar rate-limiting en
    // reclamaciones` acepta 5 solicitudes y cada una dispara DOS correos por
    // Resend (20 por pasada con los dos viewports). Este interruptor los
    // desactiva en el servidor de desarrollo que arranca la suite.
    // ⚠️ Con `reuseExistingServer`, un `npm run dev` ya levantado A MANO no
    // lo lleva: para correr la suite, deja que la levante ella.
    env: { ...process.env, E2E_SIN_EMAIL: '1' },
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
