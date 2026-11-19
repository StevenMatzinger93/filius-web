// Electron-Hilfsprogramm für make-icon.mjs: rendert das SVG-Logo transparent auf 512×512 und speichert es.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'public', 'favicon.svg'), 'utf8');
const html = `<!doctype html><html style="overflow:hidden"><body style="margin:0;overflow:hidden;background:transparent">${svg.replace(
  '<svg ',
  '<svg width="512" height="512" style="display:block" ',
)}</body></html>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    useContentSize: true,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true },
  });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise((r) => setTimeout(r, 300));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const out = path.join(root, 'build-resources', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, image.resize({ width: 512, height: 512 }).toPNG());
  console.log(`Symbol gespeichert: ${out}`);
  app.exit(0);
});
