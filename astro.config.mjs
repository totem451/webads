// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com', // TODO: reemplazar por el dominio definitivo antes de lanzar
  vite: {
    plugins: [tailwindcss()]
  },

  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      }
    }
  },

  // Sin `output: 'server'` el sitio se genera 100% estático (SSG) y se
  // sirve como assets desde Cloudflare Pages. El adapter queda listo por si
  // en el futuro se añade alguna ruta SSR puntual (ej. un endpoint de API).
  integrations: [mdx(), sitemap()],
  adapter: cloudflare()
});