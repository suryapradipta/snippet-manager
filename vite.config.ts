import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';

export default defineConfig({
  plugins: [
    electron([
      {
        entry: 'electron/main.ts',
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
      },
    ]),
  ],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html', // Now the landing page
        app: 'app.html',    // Now the main application
      },
    },
  },
});
