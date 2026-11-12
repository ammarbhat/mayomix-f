import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import '../styles/global.css'
import App from './App.jsx'
import '../styles/tablet.css'
import { queryClient } from './queryClient.js'
import { API_ROOT } from '../api/api.js'
import { installSmoothScrolling } from './installSmoothScrolling.js'

installSmoothScrolling()

// Wake the backend on every page load; the free host can take about 50 seconds to start.
void fetch(`${API_ROOT}/health`, { cache: 'no-store' }).catch((error) => {
  console.error('Unable to reach the API health endpoint.', error)
})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch((error) => {
    console.error('Unable to register the album artwork cache.', error)
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
