# Agent 对话页 · 组件拆分方案

登录成功后进入本页。外层继续用现有宫廷背景（`bg-desktop.png` / `bg-mobile.png`），中间一块约 420px 的手机卡片承载对话。

技术栈沿用现有实现：React 19、TypeScript、Vite、react-router-dom。没有 axios，也没有全局状态库。请求继续走 `src/api/client.ts` 的 `fetch` 封装，token 继续从 `localStorage`（`src/auth/session.ts`）读取。

配色沿用现有设计系统，不另起青绿主题：

| 用途 | 色值 | 来源 |
| --- | --- | --- |
| 外层背景 | 宫廷图 | `.stage` |
| 手机卡片 | `#f4ead8` / 白 | `.card` |
| 描边、焦点 | `#c9a227` | 现有金边 |
| Agent 气泡、发送按钮 | `#8b1e1e`，字 `#f4ead8` | 现有主按钮 |
| 用户气泡 | `#fffaf0` | 现有输入底 |
| 正文 | `#2a2118` | `:root` |

页面标题默认「大内陪聊官」，与附件和「小喜子」人设一致，放在常量里可改。

## 目录

可运行代码放在 `src/`，否则 Vite 编不进去，登录后也无法打开。本文件只放方案。

```
src/
  config/api.ts                      接口路径与历史条数
  types/chat.ts                      消息、状态、模式
  api/chat.ts                        非流式请求
  api/client.ts                      补一个流式入口（复用鉴权头）
  hooks/useStreamingChat.ts          SSE 解析与中止
  hooks/useChatSession.ts            消息列表状态机
  pages/Chat.tsx                     登录后的页面
  components/chat/ChatPhone.tsx      手机框
  components/chat/ChatHeader.tsx     顶栏
  components/chat/MessageList.tsx    可滚动列表
  components/chat/MessageBubble.tsx  单条气泡
  components/chat/ChatComposer.tsx   底栏输入
  components/chat/ModeSheet.tsx      流式 / 非流式弹层
  styles/chat.css                    对话页样式
vite.config.ts                       增加 /agent 代理
```

路由只改两处：`App.tsx` 里受保护的首页从 `Home` 换成 `Chat`；`Login.tsx` 已经 `navigate('/')`，不用改跳转目标。`/` 与 `/h5/` 都走同一套 `RequireAuth`。

## 各文件职责

### `src/config/api.ts`

集中可改的常量，换后端只动这里。

```ts
export const CHAT_API = {
  send: '/agent/chat',
  stream: '/agent/chat/stream',
} as const

export const CHAT_PAGE_TITLE = '大内陪聊官'
export const CHAT_TONE_TAG = '轻松吐槽模式'
```

只保留这两条 Python 路径。代码里不出现 Go 网关的 `/api/v1`。请求体是 JSON，不用 query string 传 `prompt`。`vite.config.ts` 增加 `/agent` 代理到 `127.0.0.1:8199`（原有 `/api` 代理保留给登录）。

### `src/types/chat.ts`

- `ChatRole`: `'user' | 'agent'`
- `MessageStatus`: `'sending' | 'streaming' | 'done' | 'error'`
- `ReplyMode`: `'stream' | 'complete'`（底栏 `#流式` / `#非流式`，和顶栏人设 tag 分开）
- `ChatMessage`: `id`、`role`、`content`、`status`、`createdAt`、可选 `error`
- `ChatRequestBody`: 只有 `message`。不传 `mode`，也不传 token。用哪个 URL 就是哪种模式。

### `src/api/client.ts`

现有 `request()` 会把整段响应当 JSON 信封解析，SSE 不能走它。新增 `openStream(path, init)`：同样拼 `Authorization: Bearer <token>` 和 `Content-Type`，返回原始 `Response`，不读完 body。401 或非 2xx 时抛现有 `ApiError`。

### `src/api/chat.ts`

`sendChat(body)` 调用 `request()`，发 `POST /agent/chat`。body 只有 `{ message }`。鉴权只走 `client.ts` 已有的 `Authorization: Bearer <token>`。响应对齐现有信封 `{ code, message, data }`，`data.answer` 为完整回复。

### `src/hooks/useStreamingChat.ts`

只负责一条流，不持有消息列表。

- `start(body)`：`AbortController` + `openStream(CHAT_API.stream)`，body 同样只有 `{ message }`
- `fetch` + `ReadableStream` 读流，按行缓冲，解析 `data: ` 帧。不用 query string 传 prompt
- 帧约定（与当前 Python `_sse` 一致，解析时兼容）：`{ text }` 追加、`[DONE]` 结束、`{ error }` 失败；元数据帧没有 `text` 时忽略
- 回调：`onDelta`、`onDone`、`onError`
- `abort()`：中止进行中的流；组件卸载时调用
- 同一时刻只允许一条流，新的 `start` 会先 abort 上一条

### `src/hooks/useChatSession.ts`

页面唯一的消息状态。

- `messages`、`mode`、`setMode`、`send(text)`、`retry(id)`、`busy`
- `send`：先插入用户消息（`done`）和一条空的 Agent 消息
  - 流式：Agent 状态 `streaming`，`onDelta` 把字追加进最后一条气泡；结束改 `done`；失败改 `error`
  - 非流式：Agent 状态 `sending`，输入框禁用，发送按钮转圈；拿到 `answer` 后一次性写入并改 `done`
- 请求体只有当前这一句 `message`。页面上的消息列表只用于展示，不拼进请求
- `retry` 只用失败那条对应的用户文本重发，不重复插入用户气泡

### 组件

`Chat.tsx`  
宫廷 `.stage` 里居中渲染 `ChatPhone`，把 session hook 的状态传下去。未登录仍由 `RequireAuth` 送回登录页。

`ChatPhone.tsx`  
纵向 flex：顶栏固定、列表 `flex: 1` 滚动、底栏固定。宽度 `min(420px, 100%)`，大圆角、轻阴影，视觉上是一块手机屏。

`ChatHeader.tsx`  
左：返回（清 token，回到登录页）。中：标题。右：在线圆点 + 人设 pill（`CHAT_TONE_TAG`，只展示，不发请求）。

`MessageList.tsx`  
渲染消息。新消息或流式追加时滚到底。空列表给一句简短引导。

`MessageBubble.tsx`  
- 用户：左头像、浅底气泡、字左对齐、时间在气泡左下外侧
- 用户头像 `/user_head.png`，Agent 头像 `/agent_head.png`。不用 `/xnc.png`
- Agent：右头像、酒红气泡、字左对齐、时间在气泡右下外侧
- `streaming` 且尚无文字：显示「正在输入…」和闪烁光标
- `streaming` 且已有文字：文字后跟闪烁光标
- `error`：气泡内「发送失败」+「重试」
- 用户气泡圆角约 4px，Agent 气泡圆角约 16px

`ChatComposer.tsx`  
左：当前模式 pill（`#流式` / `#非流式`），点击打开弹层。中：输入框，流式 placeholder「请输入…」，非流式「发送后等待完整回复…」。右：圆形 ↑。内容为空或 `busy` 时禁用。非流式等待时按钮改为 spinner。Enter 发送，Shift+Enter 换行。

`ModeSheet.tsx`  
底栏上方的轻量弹层，两个选项。点选后关闭并切换 `mode`。点遮罩关闭。

`styles/chat.css`  
只写对话页。移动端收紧 `.stage` 的留白，手机卡片接近全宽，顶栏和底栏避开安全区。不改登录页样式。

## 请求与状态

非流式 `POST /agent/chat`，流式 `POST /agent/chat/stream`。body 只有这一句，用哪个 URL 就是哪种模式：

```json
{
  "message": "今天上班好累啊"
}
```

顶栏「轻松吐槽模式」不进 body。token 只放在 `Authorization` 请求头。记忆由后端保存，前端不传过往消息。

`vite.config.ts` 在现有 `/api` 代理旁增加：

```ts
'/agent': {
  target: 'http://127.0.0.1:8199',
  changeOrigin: true,
}
```

| 状态 | 流式 | 非流式 |
| --- | --- | --- |
| sending | 不使用 | 输入禁用，按钮转圈，气泡占位 |
| streaming | 逐字写入，显示正在输入 | 不使用 |
| done | 光标消失，记下时间 | 一次性填入全文 |
| error | 气泡内重试，可 abort 后重发 | 气泡内重试 |

## 确认后再改的文件

- 新增：上表 `src/` 里除 `client.ts` 以外的新文件，以及 `styles/chat.css`
- 修改：`src/api/client.ts`（加 `openStream`）、`src/App.tsx`（首页换成 `Chat`）、`src/main.tsx`（引入 `chat.css`）、`vite.config.ts`（`/agent` 代理到 `127.0.0.1:8199`）
- 不动：`Login.tsx` 的跳转、`session.ts`、登录页样式、宫廷背景图
