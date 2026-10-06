// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Web Audio only exists in the browser, so the app is a client-rendered SPA.
  ssr: false,
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Synth Rack',
      meta: [
        { name: 'description', content: 'Web synthesizers modelled on classic hardware, built with Tone.js' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=VT323&display=swap',
        },
      ],
    },
  },
  typescript: {
    strict: true,
  },
  // Emit an index.html per synth so deep links work on static hosts (e.g. GitHub Pages).
  // Keep in sync with SYNTHS in synth/registry.ts.
  nitro: {
    prerender: { routes: ['/xd4', '/model-d'] },
  },
})
