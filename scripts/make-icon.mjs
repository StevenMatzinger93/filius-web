// Erzeugt build-resources/icon.png (512×512) aus public/favicon.svg – mit Electron, ohne Zusatzpakete.
// Aufruf: npm run icon
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electron = createRequire(import.meta.url)('electron');
const result = spawnSync(electron, [path.join(root, 'scripts', 'render-icon.cjs')], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
