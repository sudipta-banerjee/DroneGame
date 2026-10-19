import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Raise the advisory threshold — three.js alone is ~580 kB minified.
    chunkSizeWarningLimit: 600,

    // Vite 8 uses Rolldown, which requires the new codeSplitting.groups API
    // instead of the classic Rollup manualChunks object.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Split each heavy vendor into its own cacheable chunk.
            { name: 'vendor-three',    test: /node_modules[\\/]three[\\/]/ },
            { name: 'vendor-cannon',   test: /node_modules[\\/]cannon-es[\\/]/ },
            { name: 'vendor-nipplejs', test: /node_modules[\\/]nipplejs[\\/]/ },
          ],
        },
      },
    },
  },
});
