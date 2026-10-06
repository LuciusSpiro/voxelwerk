// Screenshots über den Editor (Server muss laufen: npm start bzw. PORT=… node server.js).
// Aufruf: node tools/shots.cjs [--port 3412] [--out shots/<team>] [--size 1600x900] <ziel> [<ziel> …]
//   ziel = "model=rom/kiste" | "figure=rom/legionaer&pose=guard" | "scene=rom-aussenposten&mood=planet_dusk"
// Playwright liegt außerhalb des Projekts (C:\tmp\pwtest). Rendert per SwiftShader (CPU) → FPS hier nicht aussagekräftig.
const path = require('path');
const fs = require('fs');
const { chromium } = require('C:/tmp/pwtest/node_modules/playwright-core');

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); if (i < 0) return def; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const port = opt('port', process.env.PORT || '3412');
const out = path.resolve(__dirname, '..', opt('out', 'shots'));
const [W, H] = opt('size', '1600x900').split('x').map(Number);
const targets = argv;
if (!targets.length) { console.log('Ziel fehlt, z. B. model=rom/kiste'); process.exit(1); }
const EXE = path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1234/chrome-win64/chrome.exe');

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  let errors = 0;
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { errors++; console.log('  [' + m.type() + ']', m.text().slice(0, 400)); } });
  page.on('pageerror', (e) => { errors++; console.log('  [pageerror]', e.message); });
  for (const t of targets) {
    const t0 = Date.now();
    await page.goto(`http://localhost:${port}/editor/?${t}&shot=1`);
    try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 240000 }); }
    catch (e) { const m = await page.textContent('#msg').catch(() => ''); console.log(`✗ ${t}: nicht bereit. Meldung: ${m}`); continue; }
    await page.waitForTimeout(1200);
    const m = await page.textContent('#msg').catch(() => '');
    if (m && /fehl|error|unbekannt|nicht/i.test(m)) console.log(`  Meldung: ${m}`);
    const stats = await page.evaluate(() => window.__stats);
    const file = path.join(out, t.replace(/^(model|figure|scene)=/, '$1-').replace(/[^a-z0-9\-_=]+/gi, '_') + '.png');
    await page.screenshot({ path: file });
    console.log(`✓ ${t}  ${stats?.hud || ''}  (${((Date.now() - t0) / 1000).toFixed(1)} s) → ${path.relative(process.cwd(), file)}`);
  }
  await browser.close();
  process.exit(errors ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
