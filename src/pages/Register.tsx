import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { ApiError } from '../api/client'
import AuthLayout from './AuthLayout'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    setLoading(true)
    try {
      await register(email.trim(), password)
      navigate('/login', { replace: true, state: { email: email.trim(), registered: true } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="注册" hint="邮箱 + 密码（至少 8 位），对应 Go 网关 /api/v1/users/register">
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? '提交中…' : '注册'}
        </button>
      </form>
      <p className="switch">
        已有账号？<Link to="/login">去登录</Link>
      </p>
    </AuthLayout>
  )
}
