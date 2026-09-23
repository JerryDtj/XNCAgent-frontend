import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register, sendRegisterCode } from '../api/auth'
import { ApiError } from '../api/client'
import { saveTokens } from '../auth/session'
import AuthLayout from './AuthLayout'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) {
      return
    }
    const timer = window.setTimeout(() => setCooldown((n) => n - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function onSendCode() {
    setError('')
    setInfo('')
    const trimmed = email.trim()
    if (!trimmed) {
      setError('请先填写邮箱')
      return
    }
    setSending(true)
    try {
      await sendRegisterCode(trimmed)
      setCooldown(60)
      setInfo('验证码已发送，请查收邮箱（1 小时内有效）')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '发送验证码失败')
    } finally {
      setSending(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    if (!/^\d{4}$/.test(code.trim())) {
      setError('请输入 4 位数字验证码')
      return
    }
    setLoading(true)
    try {
      const tokens = await register(email.trim(), password, code.trim())
      saveTokens(tokens.access_token, tokens.refresh_token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="注册" hint="请填写邮箱、验证码和密码（至少 8 位）。">
      {info ? <p className="banner ok">{info}</p> : null}
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
          验证码
          <div className="code-row">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
            />
            <button
              type="button"
              className="ghost"
              disabled={sending || cooldown > 0}
              onClick={onSendCode}
            >
              {cooldown > 0 ? `${cooldown}s` : sending ? '发送中…' : '发送验证码'}
            </button>
          </div>
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
        <label>
          确认密码
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
