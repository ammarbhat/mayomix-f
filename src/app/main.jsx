import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import '../styles/global.css'
import App from './App.jsx'
import '../styles/tablet.css'
import { queryClient } from './queryClient.js'
import { API_ROOT } from '../api/api.js'

// This is here because, when it was added, the app was hosted on a free service that needs about 50 seconds to start the backend after a period of inactivity.
void fetch(`${API_ROOT}/health`).catch(() => {})

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
