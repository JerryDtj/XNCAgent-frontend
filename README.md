# XNCAgent-frontend

小喜子 Web 前端。一期先做登录 / 注册，对接 Go 仓 [XNCAgent-go](https://github.com/JerryDtj/XNCAgent-go) 的 Gateway。

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

- `POST /api/v1/users/register` `{ email, password }`（密码至少 8 位）
- `POST /api/v1/users/login` → `access_token` / `refresh_token`
- `GET /api/v1/users/me` `Authorization: Bearer …`

成功信封是 `{ "code": 0, "message": "ok", "data": ... }`，与 Go `pkg/response` 一致。

## 页面

- `/register` 注册成功后跳登录
- `/login` 登录后把 token 写入 `localStorage`，进入 `/`
- `/` 调 `/me` 展示 `user_id` 和邮箱；无 token 则回登录
