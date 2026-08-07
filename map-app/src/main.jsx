import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import './index.css'
import App from './App.jsx'

// MapLibre v6 needs an explicit worker URL under Vite; without this the
// auto-resolved ./maplibre-gl-worker.mjs sibling 404s and the map stays blank.
setWorkerUrl(maplibreWorkerUrl)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
