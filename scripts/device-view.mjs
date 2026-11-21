// Device viewer: a dedicated port that shows the RUNNING app inside a tablet or phone frame, with Portrait / Landscape and a choice of device.
//   npm run view:tablet                     -> http://localhost:5174/  (node scripts/device-view.mjs tablet)
//   npm run view:mobile                     -> http://localhost:5175/  (node scripts/device-view.mjs mobile)
//   TABLET_PORT=6100 / MOBILE_PORT=6101     another port
//   APP_URL=http://localhost:5180 npm run view:tablet   pin the app it frames (otherwise the first app found on 5180, 5173, 5181-5185)
//
// Why a viewer and not a second `next dev`: Next.js 16 refuses a second dev server in the same folder ("Another next dev server is
// already running"), so `dev:tablet` / `dev:mobile` cannot run beside `dev`. The viewer needs no build and no second server: it frames the one dev
// server, so code edits (HMR) and the sign-in show in it at once. The iframe IS the app's origin, so its storage is the app's own.
// The app is opened with `?device=tablet` (lib/deviceType's review switch, kept for the frame's session), so it behaves as on a touch device - Open Camera
// and Upload in place of Initiate Scan, Touch Screen CAF ... - although the frame itself is a desktop browser. A phone is a touch device too, so the
// mobile view uses the same switch. Not emulated: touch input and the device's user agent.
// Nothing in the app reads this file.
import http from 'node:http';

// The kind of device, and per kind: its default port, label, devices (CSS sizes in portrait; landscape swaps them) and frame.
const KINDS = {
  tablet: {
    port: Number(process.env.TABLET_PORT ?? 5174),
    label: 'Tablet',
    fallback: 'ipad-air',
    bezel: 22,
    radius: 36,
    devices: {
      'ipad-mini': { name: 'iPad mini', w: 744, h: 1133 },
      'ipad-air': { name: 'iPad Air 11"', w: 820, h: 1180 },
      'ipad-pro-11': { name: 'iPad Pro 11"', w: 834, h: 1194 },
      'ipad-pro-13': { name: 'iPad Pro 13"', w: 1032, h: 1376 },
      'galaxy-tab-s9': { name: 'Galaxy Tab S9', w: 800, h: 1280 },
    },
  },
  mobile: {
    port: Number(process.env.MOBILE_PORT ?? 5175),
    label: 'Mobile',
    fallback: 'iphone-15',
    bezel: 12,
    radius: 48,
    devices: {
      'iphone-se': { name: 'iPhone SE', w: 375, h: 667 },
      'iphone-15': { name: 'iPhone 15', w: 393, h: 852 },
      'iphone-15-pro-max': { name: 'iPhone 15 Pro Max', w: 430, h: 932 },
      'pixel-8': { name: 'Pixel 8', w: 412, h: 915 },
      'galaxy-s24': { name: 'Galaxy S24', w: 360, h: 780 },
    },
  },
};
const KIND_NAME = process.argv[2] ?? 'tablet';
const KIND = KINDS[KIND_NAME];
if (!KIND) {
  console.error('Usage: node scripts/device-view.mjs <tablet|mobile>');
  process.exit(1);
}
const PORT = KIND.port;
const DEVICES = KIND.devices;
const CANDIDATES = [process.env.APP_URL, 'http://localhost:5180', 'http://localhost:5173', ...[5181, 5182, 5183, 5184, 5185].map((p) => `http://localhost:${p}`)]
  .filter(Boolean)
  .filter((u) => !u.endsWith(`:${PORT}`));

// The first candidate that answers like the app (its HTML title), so an unrelated server on a nearby port is never framed.
async function findApp() {
  for (const url of CANDIDATES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok && (await res.text()).includes('Vodafone Qatar DXP')) return url.replace(/\/+$/, '');
    } catch {
      /* not running there */
    }
  }
  return null;
}

const page = (appUrl) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${KIND.label} view - Vodafone Qatar DXP</title>
<style>
  :root { color-scheme: dark; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #1c1c1e; color: #f2f2f7; }
  body { display: flex; flex-direction: column; }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 16px; background: #2c2c2e; border-bottom: 1px solid #3a3a3c; }
  header h1 { font-size: 15px; font-weight: 600; margin: 0 8px 0 0; }
  .group { display: inline-flex; border: 1px solid #48484a; border-radius: 10px; overflow: hidden; }
  .group button { border: 0; border-right: 1px solid #48484a; }
  .group button:last-child { border-right: 0; }
  button, select { font: inherit; font-size: 13px; color: inherit; background: #3a3a3c; border: 1px solid #48484a; border-radius: 10px; padding: 6px 12px; cursor: pointer; }
  .group button { border-radius: 0; }
  button[aria-pressed="true"] { background: #e60000; color: #fff; }
  button:focus-visible, select:focus-visible { outline: 2px solid #64d2ff; outline-offset: 2px; }
  .meta { font-size: 12px; color: #aeaeb2; margin-left: auto; }
  main { flex: 1; display: grid; place-items: center; overflow: auto; padding: 24px; }
  .stage { position: relative; }
  .device { position: absolute; top: 0; left: 0; transform-origin: 0 0; background: #0b0b0c; border-radius: ${KIND.radius}px; padding: ${KIND.bezel}px; box-shadow: 0 20px 60px rgba(0,0,0,.55), inset 0 0 0 2px #3a3a3c; transition: width .25s, height .25s; }
  .screen { width: 100%; height: 100%; border: 0; border-radius: 14px; background: #fff; display: block; }
  .empty { max-width: 460px; text-align: center; line-height: 1.5; color: #d1d1d6; }
  code { background: #3a3a3c; padding: 2px 6px; border-radius: 6px; }
</style>
</head>
<body>
<header>
  <h1>${KIND.label} view</h1>
  <label>Device <select id="device" aria-label="Device">${Object.entries(DEVICES)
    .map(([k, d]) => `<option value="${k}">${d.name} (${d.w}×${d.h})</option>`)
    .join('')}</select></label>
  <div class="group" role="group" aria-label="Orientation">
    <button type="button" data-o="portrait">Portrait</button>
    <button type="button" data-o="landscape">Landscape</button>
  </div>
  <button type="button" id="rotate" title="Rotate (R)">Rotate ⟳</button>
  <div class="group" role="group" aria-label="Zoom">
    <button type="button" data-z="fit">Fit</button>
    <button type="button" data-z="100">100%</button>
  </div>
  <button type="button" id="reload">Reload</button>
  <span class="meta" id="meta"></span>
</header>
<main>
  ${
    appUrl
      ? `<div class="stage" id="stage"><div class="device" id="device-frame"><iframe class="screen" id="screen" title="Vodafone Qatar DXP on a ${KIND_NAME === 'mobile' ? 'phone' : 'tablet'}" src="${appUrl}/?device=tablet"></iframe></div></div>`
      : `<p class="empty">The app is not running. Start it with <code>npm run dev</code> (or the Claude preview), then reload this page.<br>Looked on 5173 and 5180-5185; set <code>APP_URL</code> to point elsewhere.</p>`
  }
</main>
<script>
  const DEVICES = ${JSON.stringify(DEVICES)};
  const APP = ${JSON.stringify(appUrl)};
  const BEZEL = ${KIND.bezel};
  // The choice lives in the address (?device=&orientation=&zoom=), so a view can be bookmarked or shared.
  const q = new URLSearchParams(location.search);
  const state = {
    device: DEVICES[q.get('device')] ? q.get('device') : ${JSON.stringify(KIND.fallback)},
    orientation: q.get('orientation') === 'landscape' ? 'landscape' : 'portrait',
    zoom: q.get('zoom') === '100' ? '100' : 'fit',
  };
  const $ = (id) => document.getElementById(id);
  function render() {
    const d = DEVICES[state.device];
    const [w, h] = state.orientation === 'portrait' ? [d.w, d.h] : [d.h, d.w];
    $('device').value = state.device;
    document.querySelectorAll('[data-o]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.o === state.orientation)));
    document.querySelectorAll('[data-z]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.z === state.zoom)));
    history.replaceState(null, '', '?' + new URLSearchParams(state));
    const frame = $('device-frame');
    if (!frame) return;
    const outerW = w + BEZEL * 2, outerH = h + BEZEL * 2;
    const main = document.querySelector('main');
    const scale = state.zoom === '100' ? 1 : Math.min(1, (main.clientWidth - 48) / outerW, (main.clientHeight - 48) / outerH);
    frame.style.width = outerW + 'px';
    frame.style.height = outerH + 'px';
    frame.style.transform = 'scale(' + scale + ')';
    $('stage').style.width = outerW * scale + 'px';
    $('stage').style.height = outerH * scale + 'px';
    $('meta').textContent = d.name + ' · ' + state.orientation + ' · ' + w + '×' + h + ' · ' + Math.round(scale * 100) + '% · ' + APP;
  }
  $('device').addEventListener('change', (e) => { state.device = e.target.value; render(); });
  document.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('click', () => { state.orientation = b.dataset.o; render(); }));
  document.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => { state.zoom = b.dataset.z; render(); }));
  const rotate = () => { state.orientation = state.orientation === 'portrait' ? 'landscape' : 'portrait'; render(); };
  $('rotate').addEventListener('click', rotate);
  $('reload').addEventListener('click', () => { const s = $('screen'); if (s) s.src = s.src; });
  document.addEventListener('keydown', (e) => { if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && e.target === document.body) rotate(); });
  addEventListener('resize', render);
  render();
</script>
</body>
</html>`;

http
  .createServer(async (req, res) => {
    if (req.url === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
    const appUrl = await findApp();
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(page(appUrl));
  })
  .listen(PORT, () => {
    console.log(`${KIND.label} view ready on http://localhost:${PORT}/  (portrait / landscape, device picker)`);
  });
