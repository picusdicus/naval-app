const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/transporte', { waitUntil: 'networkidle' });
  
  // Wait for the page to fully render
  await page.waitForSelector('.nv-card', { timeout: 5000 }).catch(() => {});
  
  // Check if the Sentido component exists and has the expected structure
  const firstBadge = await page.locator('span.bg-secondary-container').first().textContent();
  console.log('First badge text:', firstBadge);
  
  // Take a screenshot of a section with buses
  await page.screenshot({ path: 'transporte-screenshot.png' });
  console.log('Screenshot saved to transporte-screenshot.png');
  
  // Check for the API call to bus-times
  page.on('response', (response) => {
    if (response.url().includes('/api/bus-times')) {
      console.log('API call detected:', response.url(), response.status());
    }
  });
  
  // Wait a bit to see if any API calls are made
  await page.waitForTimeout(2000);
  
  await browser.close();
})().catch(console.error);
