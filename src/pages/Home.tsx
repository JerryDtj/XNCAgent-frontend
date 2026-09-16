import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { me, type Me } from '../api/auth'
import { ApiError } from '../api/client'
import { clearTokens } from '../auth/session'

export default function Home() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    me()
      .then(setProfile)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === 40101) {
          clearTokens()
          navigate('/login', { replace: true })
          return
        }
        setError(err instanceof ApiError ? err.message : '加载失败')
      })
  }, [navigate])

  function logout() {
    clearTokens()
    navigate('/login', { replace: true })
  }

  return (
    <div className="stage">
      <div className="card">
        <p className="eyebrow">XNCAgent · 小喜子</p>
        <h1>已入值</h1>
        <p className="hint">token 有效，已从 GET /api/v1/users/me 取回身份。</p>
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
