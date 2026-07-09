import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.createContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to map page...');
    await page.goto('http://localhost:5173/mapa', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Screenshot 1: Initial state
    console.log('Taking screenshot 1: initial state');
    const screenshot1 = await page.screenshot({ fullPage: true });
    writeFileSync('screenshot-1-initial.png', screenshot1);
    
    // Find and click first commerce item
    console.log('Looking for first commerce item...');
    const items = await page.locator('li, [class*="item"]').count();
    console.log(`Found ${items} items in the list`);
    
    if (items > 0) {
      console.log('Clicking first item...');
      await page.locator('li, [class*="item"]').first().click();
      await page.waitForTimeout(1000);
      
      // Screenshot 2: After click
      console.log('Taking screenshot 2: after clicking');
      const screenshot2 = await page.screenshot({ fullPage: true });
      writeFileSync('screenshot-2-after-click.png', screenshot2);
      
      // Check if detail is visible
      const detailVisible = await page.evaluate(() => {
        const detail = document.querySelector('[class*="detalle"], [class*="detail"]');
        if (detail) {
          const rect = detail.getBoundingClientRect();
          return rect.top >= 0 && rect.top <= window.innerHeight;
        }
        return false;
      });
      
      console.log('Detail visible:', detailVisible);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
