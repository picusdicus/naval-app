import { defineConfig, devices } from '@playwright/test'
import { BASE_URL, PUERTO } from './e2e/entorno.js'

// Los tests atacan el servidor de desarrollo real (Vite + los handlers de api/),
// contra la base de datos Neon y el store de Vercel Blob de verdad. No hay
// mocks: si la subida de imágenes se rompe, estos tests se caen.
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

  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 5'] } },
  ],

  webServer: {
    command: `npm run dev -- --port ${PUERTO} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
