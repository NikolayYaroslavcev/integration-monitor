import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': `http://localhost:${process.env.PORT ?? 3001}` },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
