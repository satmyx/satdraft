const puppeteer = require('puppeteer');

async function screenshotDraft(url) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Laisse le temps au WebSocket de livrer l'état et aux images de se charger
    await new Promise(r => setTimeout(r, 3500));
    // Masquer le banner "Draft terminé !" pour voir les champions
    await page.evaluate(() => {
      const banner = document.getElementById('finished-banner');
      if (banner) banner.style.display = 'none';
    });
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}

module.exports = { screenshotDraft };
