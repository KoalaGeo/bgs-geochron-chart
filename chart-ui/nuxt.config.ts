import { resolve } from "node:path"

// CHART_SOURCE=bgs builds the BGS chart from bgs/build/bgs-chart.ttl
// (generate it with bgs/build_bgs_chart.py); anything else builds the ICS chart.
const chartSource = process.env.CHART_SOURCE === "bgs" ? "bgs" : "ics"

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  css: ['~/assets/ics-theme.css'],
  compatibilityDate: '2026-06-23',
  ssr:false,
  runtimeConfig: {
    public: { chartSource },
  },
  // BGS build: publish the generated data and build report at <base>/data/.
  nitro: chartSource === "bgs"
    ? { publicAssets: [{ dir: resolve(__dirname, "../bgs/build"), baseURL: "data" }] }
    : {},
  modules: [
    '@vueuse/nuxt',
  ],
  vite: {
    server: {
      fs: {
        allow: [
          resolve(__dirname, ".."),
        ],
      },
    },
  },
  app: {
    // Read the env var here, not only at runtime: the prerenderer takes its
    // base from this value, so a different NUXT_APP_BASE_URL (e.g. a fork's
    // /<repo>/ on GitHub Pages) otherwise fails with "Cannot find any path
    // matching /chart".
    baseURL: process.env.NUXT_APP_BASE_URL || '/chart/',
      head: {
        title: chartSource === "bgs" ? "BGS Geochronological Chart" : "International Chronostratigraphic Chart",
        meta:[
{charset: "utf-8"}
        ],
        link: chartSource === "bgs" ? [] : [
          { rel: 'icon', type: 'image/vnd.microsoft.icon', href: 'images/logo-ics.ico' },
          { rel: 'shortcut icon', type: 'image/vnd.microsoft.icon', href: 'images/logo-ics.ico' }
        ]
      },
    },
})
