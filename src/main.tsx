import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { boot, goToLogin } from './auth'
import './index.css'
import './styles/chat.css'
import App from './App.tsx'

function isLoginRoute() {
  const path = window.location.pathname
  return path === '/login' || path.endsWith('/login')
}

void (async () => {
  const ok = await boot()
  if (!ok && !isLoginRoute()) {
    goToLogin()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})()
