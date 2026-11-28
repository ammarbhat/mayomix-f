export const VINYL_ASSET_URLS = ['/images/vinyl.png', '/images/vinyl-half.png']

let preloadJob = null

function warmServiceWorkerCache() {
  if (!('serviceWorker' in navigator)) return
  const message = { type: 'CACHE_VINYL_ASSETS', urls: VINYL_ASSET_URLS }
  navigator.serviceWorker.controller?.postMessage(message)
  navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage(message)).catch(() => {})
}

export function preloadVinylAssets() {
  if (preloadJob) return preloadJob
  warmServiceWorkerCache()
  preloadJob = Promise.all(VINYL_ASSET_URLS.map((src) => new Promise((resolve) => {
    const image = new Image()
    image.onload = image.onerror = resolve
    image.src = src
  })))
  return preloadJob
}
