export default defineNuxtConfig({
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  ssr: false,

  // Dev server port — override with PORT env var
  devServer: {
    port: parseInt(process.env.PORT || '3000'),
  },

  nitro: {
    // Allow native Node.js modules used by @kubernetes/client-node
    experimental: {
      asyncContext: true,
    },
  },

  tailwindcss: {
    config: {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            'surface': '#0f0f0f',
            'surface-2': '#1a1a1a',
            'surface-3': '#252525',
            'border': '#2a2a2a',
          },
        },
      },
    },
  },
})
