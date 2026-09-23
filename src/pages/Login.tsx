import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { ApiError } from '../api/client'
import { saveTokens } from '../auth/session'
import { useBasePath, withBase } from '../nav'
import AuthLayout from './AuthLayout'
import PasswordField from './PasswordField'

export default function Login() {
  const navigate = useNavigate()
  const base = useBasePath()
  const [email, setEmail] = useState('')
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
      navigate(withBase(base, '/'), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="登录">
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
        <PasswordField
          label="密码"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
      <p className="switch">
        还没有账号？<Link to={withBase(base, '/register')}>去注册</Link>
      </p>
    </AuthLayout>
  )
}
