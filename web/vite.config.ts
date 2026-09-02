import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { generateSW } from 'workbox-build'

/**
 * TanStack Start (Vinxi/Nitro-based) sets `build.ssr = true` for every build,
 * which breaks vite-plugin-pwa / @serwist/vite (their `!build.ssr` guard never
 * passes, see TanStack/router#4988). Instead we generate the service worker
 * manually with workbox-build once the client build has been written to disk.
 *
 * TanStack Start runs multiple environment builds in a single `vite build`
 * (client, then server), so `writeBundle` fires more than once — we only
 * generate the SW for the build whose output lands in `.output/public`.
 */
function pwaServiceWorker(): Plugin {
  let generated = false

  return {
    name: 'pwa:generate-service-worker',
    apply: 'build',
    async writeBundle(options) {
      if (generated) return

      // Only the client build writes to the Nitro public dir (.output/public).
      // Its bundle contains the hashed CSS/JS client assets; the server build
      // emits .mjs chunks into .output/server.
      const outDir = options.dir ?? ''
      const isClientOutput = outDir.endsWith('.output/public')
      if (!isClientOutput) return

      // `vite build` runs from the project root (web/).
      const publicDir = path.resolve(process.cwd(), '.output/public')
      generated = true

      await generateSW({
        globDirectory: publicDir,
        globPatterns: ['assets/**/*.{js,css,svg,png,woff,woff2}'],
        swDest: path.join(publicDir, 'sw.js'),
        // The manifest/icons live in public/ but Nitro copies it into
        // .output/public AFTER the client build's writeBundle fires, so they
        // can't be picked up by globDirectory at that point. Add them as
        // explicit unhashed entries instead.
        additionalManifestEntries: [
          { url: '/manifest.webmanifest', revision: null },
          { url: '/icons/icon.svg', revision: null },
          { url: '/icons/icon-192.png', revision: null },
          { url: '/icons/icon-512.png', revision: null },
        ],
        // navigateFallback is intentionally NOT set: the app is SSR'd, so
        // precached HTML doesn't exist. Runtime caching covers navigations.
        runtimeCaching: [
          {
            // Network-first with a timeout fallback for SSR navigations so
            // pages remain readable offline once visited.
            // Serialized into the SW by workbox-build, executed in SW scope.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            urlPattern: (({ request }: any) => request.mode === 'navigate') as never,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
          {
            // Stale-while-revalidate for same-origin API/data requests.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            urlPattern: (({ url }: any) => url.pathname.startsWith('/api/')) as never,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      })

      console.log('[pwa] service worker generated at .output/public/sw.js')
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    pwaServiceWorker(),
  ],
})

export default config
