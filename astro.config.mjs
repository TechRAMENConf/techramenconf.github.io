import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
// https://astro.build/config
export default defineConfig( {
  site: 'https://techramenconf.net/',
  integrations: [tailwind()],
  redirects: {
    '/2024': '/2024/index.html'
  }
} )
