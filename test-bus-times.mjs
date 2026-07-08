import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/transporte', { waitUntil: 'domcontentloaded' });
  
  // Wait for bus line cards to load
  await page.waitForSelector('article.nv-card', { timeout: 5000 }).catch(() => {});
  
  // Get the first bus badge to verify structure
  const firstBadge = await page.locator('span.bg-secondary-container').first().textContent().catch(() => 'N/A');
  console.log('First badge text:', firstBadge);
  
  // Check page title
  const title = await page.title();
  console.log('Page title:', title);
  
  // Check if there are bus cards
  const cardCount = await page.locator('article.nv-card').count();
  console.log('Number of bus line cards:', cardCount);
  
  await browser.close();
})().catch(console.error);
