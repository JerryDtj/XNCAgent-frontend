import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getAccessToken } from './auth/session'
import { useBasePath, withBase } from './nav'
import Home from './pages/Home'
import Login from './pages/Login'

function RequireAuth({ children }: { children: ReactNode }) {
  const base = useBasePath()
  if (!getAccessToken()) {
    return <Navigate to={withBase(base, '/login')} replace />
  }
  return children
}

function RedirectLogin() {
  const base = useBasePath()
  return <Navigate to={withBase(base, '/login')} replace />
}

function SiteRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="register" element={<RedirectLogin />} />
      <Route
        index
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route path="*" element={<RedirectLogin />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/h5/*" element={<SiteRoutes />} />
        <Route path="/*" element={<SiteRoutes />} />
      </Routes>
    </BrowserRouter>
  )
}
