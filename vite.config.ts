import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-motion': ['motion'],
            'vendor-icons': ['lucide-react'],
            'vendor-globe': ['cobe']
          }
        }
      }
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      watch: {
        ignored: ['**/pictures/**', '**/assets/**', '**/.git/**', '**/dist/**', '**/*.jpeg', '**/*.jpg', '**/*.png'],
        usePolling: false,
      },
    },
  };
});

