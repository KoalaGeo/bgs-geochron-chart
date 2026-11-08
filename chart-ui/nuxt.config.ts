import { resolve } from "node:path"

// CHART_SOURCE=bgs builds the BGS chart from bgs/build/bgs-chart.ttl
// (generate it with bgs/build_bgs_chart.py); anything else builds the ICS chart.
const chartSource = process.env.CHART_SOURCE === "bgs" ? "bgs" : "ics"

// Read the env var here, not only at runtime: the prerenderer takes its
// base from this value, so a different NUXT_APP_BASE_URL (e.g. a fork's
// /<repo>/ on GitHub Pages) otherwise fails with "Cannot find any path
// matching /chart".
const baseURL = process.env.NUXT_APP_BASE_URL || '/chart/'

// Name of the BGS site, shown in the page title and the header breadcrumb.
const bgsSiteName = "BGS Geochronology, Lexicon & Rock Classification"

// BGS www-apps <head> include (head.noGTM.htm: this site is not hosted on
// WEBAPPS, so no Google Tag Manager): Aileron from Adobe Fonts and the BGS
// favicons. The favicons are copied into public/images/bgs/ so they resolve
// under any base URL.
const bgsHeadLinks = [
  { rel: 'stylesheet', id: 'bgs-fonts-css', href: 'https://use.typekit.net/mvn4zqf.css?ver=1.0.2', type: 'text/css', media: 'all' },
  { rel: 'icon', href: `${baseURL}images/bgs/cropped-BGS-favicon-logo-32x32.png`, sizes: '32x32' },
  { rel: 'icon', href: `${baseURL}images/bgs/cropped-BGS-home-screen-150x150.png`, sizes: '150x150' },
  { rel: 'apple-touch-icon', href: `${baseURL}images/bgs/cropped-BGS-favicon-logo-180x180.png` },
]

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  css: chartSource === "bgs"
    ? ['~/assets/ics-theme.css', '~/assets/bgs-site.css']
    : ['~/assets/ics-theme.css'],
  compatibilityDate: '2026-06-23',
  ssr:false,
  runtimeConfig: {
    public: { chartSource, siteName: chartSource === "bgs" ? bgsSiteName : "" },
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
    baseURL,
      head: {
        htmlAttrs: chartSource === "bgs" ? { lang: 'en' } : {},
        title: chartSource === "bgs" ? bgsSiteName : "International Chronostratigraphic Chart",
        meta:[
{charset: "utf-8"}
        ],
        link: chartSource === "bgs" ? bgsHeadLinks : [
          { rel: 'icon', type: 'image/vnd.microsoft.icon', href: 'images/logo-ics.ico' },
          { rel: 'shortcut icon', type: 'image/vnd.microsoft.icon', href: 'images/logo-ics.ico' }
        ]
      },
    },
})
