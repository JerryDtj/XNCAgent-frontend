import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { ApiError } from '../api/client'
import { saveTokens } from '../auth/session'
import AuthLayout from './AuthLayout'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const presetEmail = (location.state as { email?: string } | null)?.email ?? ''
  const justRegistered = Boolean((location.state as { registered?: boolean } | null)?.registered)

  const [email, setEmail] = useState(presetEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const tokens = await login(email.trim(), password)
      saveTokens(tokens.access_token, tokens.refresh_token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="登录" hint="用注册邮箱进入，对应 Go 网关 /api/v1/users/login">
      {justRegistered ? <p className="banner ok">注册成功，请登录。</p> : null}
      {error ? <p className="banner err">{error}</p> : null}
      <form onSubmit={onSubmit}>
        <label>
          邮箱
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          密码
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
      <p className="switch">
        还没有账号？<Link to="/register">去注册</Link>
      </p>
    </AuthLayout>
  )
}
