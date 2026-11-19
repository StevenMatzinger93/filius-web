import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Rein statisches Bundle: relative Pfade, damit es unter jedem Unterpfad läuft
// (GitHub Pages, Cloudflare Pages, lokaler Ordner).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1024,
    rolldownOptions: {
      // react-compiler-runtime (Abhängigkeit von @xyflow/react) enthält die Direktive «use no memo»,
      // die beim Bündeln bedeutungslos ist. Nur diese eine Meldung wird unterdrückt.
      onLog(level, log, handler) {
        if (log.code === 'MODULE_LEVEL_DIRECTIVE' && log.id?.includes('react-compiler-runtime')) return;
        handler(level, log);
      },
    },
  },
});
