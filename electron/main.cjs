/*
 * Desktop-Hülle für Filius Web (optional). Die App bleibt ein statisches Web-Bundle in dist/;
 * diese Hülle liefert es nur auf 127.0.0.1 aus und zeigt es in einem Desktop-Fenster.
 *
 *   npx electron .                        Fenster öffnen
 *   npx electron . --screenshot bild.png  Bild speichern und beenden
 *
 * Mit --screenshot: Fenster ohne Fokus (unsichtbar gerendert, Zeichnen läuft auch im Hintergrund),
 * nach etwa 120 Bildern wird das Fensterbild als PNG gespeichert und das Programm beendet.
 */
const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const WIDTH = 1440;
const HEIGHT = 900;
const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
};

function screenshotTarget() {
  const i = process.argv.indexOf('--screenshot');
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null;
}

/** Statischer Server nur für dist/ (Module-Worker brauchen http statt file://). */
function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.resolve(DIST, relative);
      if (!file.startsWith(path.resolve(DIST))) {
        res.writeHead(403).end();
        return;
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }),
    );
  });
}

async function main() {
  const shot = screenshotTarget();
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ fehlt – bitte zuerst «npm run build» ausführen.');
    app.exit(1);
    return;
  }
  if (shot) {
    // Eigener, leerer Speicher: der Prüflauf zeigt immer das Beispielnetz, nie Daten der Person.
    app.setPath('userData', fs.mkdtempSync(path.join(app.getPath('temp'), 'filius-web-shot-')));
  }
  await app.whenReady();
  const { server, url } = await startServer();

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    useContentSize: true,
    title: 'Filius Web',
    show: !shot,
    focusable: !shot,
    paintWhenInitiallyHidden: true,
    autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true },
  });
  win.on('closed', () => server.close());
  await win.loadURL(url);

  if (!shot) return;

  // Etwa 120 Bilder abwarten, damit Layout, Worker und Zeichenfläche fertig sind.
  await win.webContents.executeJavaScript(
    'new Promise((r) => { let n = 0; const f = () => (++n >= 120 ? r(n) : requestAnimationFrame(f)); requestAnimationFrame(f); setTimeout(() => r(n), 8000); })',
  );
  const image = await win.webContents.capturePage();
  const png = image.toPNG();
  if (png.length === 0 || image.isEmpty()) {
    console.error('Das Bild ist leer.');
    app.exit(1);
    return;
  }
  fs.mkdirSync(path.dirname(shot), { recursive: true });
  fs.writeFileSync(shot, png);
  console.log(`Bild gespeichert: ${shot}`);
  win.destroy();
  server.close();
  app.exit(0);
}

app.on('window-all-closed', () => app.quit());
main().catch((err) => {
  console.error(err);
  app.exit(1);
});
