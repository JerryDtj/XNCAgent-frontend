import type { ReactNode } from 'react'

type Props = {
  title: string
  hint?: string
  children: ReactNode
}

export default function AuthLayout({ title, hint, children }: Props) {
  return (
    <div className="stage">
      <div className="card">
        <p className="eyebrow">XNCAgent · 小喜子</p>
        <h1>{title}</h1>
        {hint ? <p className="hint">{hint}</p> : null}
        {children}
      </div>
    </div>
  )
}
