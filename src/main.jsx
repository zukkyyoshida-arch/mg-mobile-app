import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Dashboard from './components/Dashboard.jsx'
import Archives from './components/Archives.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/archives" element={<Archives />} />
      </Routes>
    </MemoryRouter>
  </StrictMode>,
)
