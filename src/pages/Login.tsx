import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, sendLoginCode } from '../api/auth'
import { ApiError } from '../api/client'
import { saveTokens } from '../auth/session'
import { useBasePath, withBase } from '../nav'
import AuthLayout from './AuthLayout'

export default function Login() {
  const navigate = useNavigate()
  const base = useBasePath()
  const [email, setEmail] = useState('')
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
      await sendLoginCode(trimmed)
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
    if (!/^\d{4}$/.test(code.trim())) {
      setError('请输入 4 位数字验证码')
      return
    }
    setLoading(true)
    try {
      const tokens = await login(email.trim(), code.trim())
      saveTokens(tokens.access_token, tokens.refresh_token)
      navigate(withBase(base, '/'), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="登录" hint="用邮箱验证码进入。未注册的邮箱验证成功后会自动开通账号。">
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
        <button type="submit" disabled={loading}>
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
    </AuthLayout>
  )
}
