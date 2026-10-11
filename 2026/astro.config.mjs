import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://techramenconf.net/',
  base: '/2026',
  vite: {
    // 開発サーバー用: ページごとに後から見つかる依存（観光ページの maplibre など）を
    // 起動時にまとめて事前バンドルしておく。途中で再バンドルが走ると、開いているページが
    // 古いチャンクを参照して「504 Outdated Optimize Dep」になり、地図などが表示されない
    optimizeDeps: {
      include: ['maplibre-gl', 'three', 'three/addons/utils/BufferGeometryUtils.js'],
    },
  },
})
