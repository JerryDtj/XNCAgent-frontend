# XNCAgent-frontend

小喜子 Web 前端。一期做邮箱验证码登录，对接 Go 仓 [XNCAgent-go](https://github.com/JerryDtj/XNCAgent-go) 的 Gateway。未注册的邮箱验证成功后会自动开通账号。

| 仓库 | 职责 |
|------|------|
| XNCAgent | Python Agent Core |
| XNCAgent-go | Gateway / User / 本地 compose |
| **XNCAgent-frontend**（本仓） | React 页面 |

## 环境

- Node 18+（已用 Vite + React + TypeScript）
- 本机先起 Go 网关：`http://127.0.0.1:8199`
- Postgres 要用 Go 仓的 `make up` 或 `docker compose -f deploy/docker-compose.yaml up -d`

## 运行

```bash
cd XNCAgent-frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:8080`。Vite 把 `/api` 代理到 Gateway `:8199`，所以前端请求：

- `POST /api/v1/users/send-code` `{ email }`
- `POST /api/v1/users/login` `{ email, code }` → `access_token`（refresh token 由网关写入 httpOnly Cookie，7 天有效，前端不接触、不可读）
- `POST /api/v1/users/refresh` → 用 Cookie 里的 refresh token 换新 access token（旧 token 旋转作废）
- `POST /api/v1/users/logout` → 删库吊销 refresh token 并清 Cookie
- `GET /api/v1/users/me` `Authorization: Bearer …`

成功信封是 `{ "code": 0, "message": "ok", "data": ... }`，与 Go `pkg/response` 一致。

## 功能

- **邮箱验证码登录**：未注册的邮箱验证成功后自动开通账号
- **多会话聊天**：侧边栏会话列表（新建 / 改名 / 删除、`<`/`>` 收起展开），SSE 流式输出，自动标题
- **登录态**：access token 存内存，refresh token 走 httpOnly Cookie（7 天），401 自动静默刷新重放
- **短期记忆**：当前会话最近 5 轮随请求带上，多轮对话能接住指代
- **跨会话记忆**：agent 自动判断是否需要回忆，命中的旧会话上下文注入回复
- **语义搜索**：放大镜弹层，向量召回结果点击后锚点跳转并高亮对应消息
- 桌面端横版宫墙夜景背景，手机端（宽度 ≤ 768px）自动换竖版，可用 `/h5` 路径

## 页面

- `/login`、`/h5/login` 登录；`/register` 已下线，会跳到登录
- `/`、`/h5` 登录后的聊天主页
