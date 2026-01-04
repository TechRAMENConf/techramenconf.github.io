import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: 'https://techramenconf.net/',
  base: '/2026',
  integrations: [tailwind()]
})
