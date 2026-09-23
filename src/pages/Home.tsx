import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { me, type Me } from '../api/auth'
import { ApiError } from '../api/client'
import { clearTokens } from '../auth/session'
import { useBasePath, withBase } from '../nav'

export default function Home() {
  const navigate = useNavigate()
  const base = useBasePath()
  const [profile, setProfile] = useState<Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    me()
      .then(setProfile)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === 40101) {
          clearTokens()
          navigate(withBase(base, '/login'), { replace: true })
          return
        }
        setError(err instanceof ApiError ? err.message : '加载失败')
      })
  }, [navigate, base])

  function logout() {
    clearTokens()
    navigate(withBase(base, '/login'), { replace: true })
  }

  return (
    <div className="stage">
      <div className="card">
        <p className="eyebrow">XNCAgent · 小喜子</p>
        <h1>已入值</h1>
        <p className="hint">欢迎回来。</p>
        {error ? <p className="banner err">{error}</p> : null}
        {profile ? (
          <dl className="profile">
            <div>
              <dt>user_id</dt>
              <dd>{profile.user_id}</dd>
            </div>
            <div>
              <dt>email</dt>
              <dd>{profile.email}</dd>
            </div>
          </dl>
        ) : (
          !error && <p className="hint">读取中…</p>
        )}
        <button type="button" onClick={logout}>
          退出
        </button>
      </div>
    </div>
  )
}
