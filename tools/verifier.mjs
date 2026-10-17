// Vérification de toutes les pages du site avant publication (Chromium headless, CDP).
// Usage : node tools/verifier.mjs http://127.0.0.1:8131
import { spawn } from 'node:child_process';
const BASE = process.argv[2] || 'http://127.0.0.1:8131';
const PAGES = ['', 'results.html', 'benchmarks/', 'benchmarks/bakery-site/', 'benchmarks/snake-game/', 'compare.html', 'compare.html?b=snake-game',
  'models/qwen3.5-9b/', 'models/ornith-1.5-9b/', 'models/neohorse-1-9b/', 'privacy.html', 'legal.html'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9336;
const p = spawn('chromium', ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--user-data-dir=/tmp/kb-verif', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
let echecs = 0;
try {
  for (const pg of PAGES) {
    const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    let id = 0; const att = new Map(); const errs = [];
    ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && att.has(d.id)) { att.get(d.id)(d); att.delete(d.id); }
      else if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
      else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/favicon/.test(d.params.entry.url || '')) errs.push(d.params.entry.text + ' ' + (d.params.entry.url || '')); });
    const cdp = (method, params = {}) => new Promise(r => { const i = ++id; att.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Log.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1369, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.navigate', { url: `${BASE}/${pg}` });
    await sleep(2500);
    const r = (await cdp('Runtime.evaluate', { returnByValue: true, expression: `(() => {
      const nav = [...document.querySelectorAll('.top nav a')];
      const tops = new Set(nav.map(a => Math.round(a.getBoundingClientRect().top)));
      return { titre: document.title, nav: nav.map(a => a.textContent).join('|'), aligne: tops.size === 1,
        erreurTexte: /could not be loaded/i.test(document.body.innerText), iframes: document.querySelectorAll('iframe').length,
        chk: document.querySelectorAll('[data-checks]').length, lignes: document.querySelectorAll('#results tbody tr').length };
    })()` })).result.result.value;
    const ok = !r.erreurTexte && r.aligne && r.nav === 'Results|Benchmarks|Compare|Alerts' && errs.length === 0;
    if (!ok) echecs++;
    console.log(`${ok ? 'OK ' : 'KO '} ${('/' + pg).padEnd(30)} menu ${r.aligne ? 'aligné' : 'DÉCALÉ'} [${r.nav}] iframes ${r.iframes} scores ${r.chk} lignes ${r.lignes}${r.erreurTexte ? ' ERREUR DONNÉES' : ''}${errs.length ? ' JS: ' + errs.join(' ; ').slice(0, 200) : ''}`);
    ws.close(); await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`).catch(() => {});
  }
} finally { p.kill(); }
console.log(echecs ? `${echecs} page(s) en échec` : 'toutes les pages OK');
process.exit(echecs ? 1 : 0);
