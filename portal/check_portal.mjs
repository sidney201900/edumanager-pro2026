import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.error('REQUEST FAILED:', request.url(), request.failure().errorText));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' }).catch(e => console.log(e));

  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
