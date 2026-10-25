import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { Readable } from 'node:stream'

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}

async function serveArtworkProxy(request, response, next) {
  if (request.method !== 'GET') return next()

  let artworkPath
  try {
    const requestUrl = new URL(request.url || '/', 'http://mayomix.local')
    const match = requestUrl.pathname.match(/^\/artwork\/(release|release-group)\/([\da-f-]+)\/front-250\/?$/i)
    if (!match) return next()
    artworkPath = requestUrl.pathname.replace(/^\/artwork/, '')
  } catch {
    return next()
  }

  try {
    const upstream = await fetch(`https://coverartarchive.org${artworkPath}`, { redirect: 'follow' })
    if (!upstream.ok || !upstream.body) {
      response.statusCode = upstream.status
      response.end()
      return
    }

    response.statusCode = 200
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    response.setHeader('Cache-Control', 'public, max-age=2592000, immutable')
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) response.setHeader('Content-Length', contentLength)
    Readable.fromWeb(upstream.body).pipe(response)
  } catch (error) {
    next(error)
  }
}

const artworkCacheProxy = {
  name: 'mayomix-artwork-cache-proxy',
  configureServer(server) {
    server.middlewares.use(serveArtworkProxy)
  },
  configurePreviewServer(server) {
    server.middlewares.use(serveArtworkProxy)
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), artworkCacheProxy],
  server: { host: '0.0.0.0', proxy: apiProxy },
  preview: { proxy: apiProxy },
})
