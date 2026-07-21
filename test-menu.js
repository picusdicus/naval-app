import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto('http://localhost:5175/');
  
  // Click en el menú hamburguesa
  await page.click('button[aria-label="Abrir menú"]');
  await page.waitForTimeout(500);
  
  // Verifica que el menú está abierto
  const menu = await page.locator('text=Buzón de sugerencias').isVisible();
  console.log('Buzón de sugerencias visible:', menu);
  
  if (menu) {
    // Click en Buzón de sugerencias
    await page.click('text=Buzón de sugerencias');
    await page.waitForNavigation();
    
    const url = page.url();
    console.log('URL después del click:', url);
    console.log('Navegación correcta:', url.includes('/sugerencias'));
  }
  
  await browser.close();
})().catch(console.error);
