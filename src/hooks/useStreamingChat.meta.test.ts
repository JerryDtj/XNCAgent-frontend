import { describe, expect, it, vi } from 'vitest'
import { readChatStream } from '../hooks/useStreamingChat'

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  let i = 0
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (i >= chunks.length) {
              return { done: true, value: undefined }
            }
            const value = encoder.encode(chunks[i])
            i += 1
            return { done: false, value }
          },
        }
      },
    },
  } as Response
}

vi.mock('../api/client', () => ({
  openStream: vi.fn(),
}))

describe('readChatStream meta frames', () => {
  it('routes event:meta to onMeta and keeps tokens on message path', async () => {
    const { openStream } = await import('../api/client')
    vi.mocked(openStream).mockResolvedValue(
      sseResponse([
        'data: {"session_id":12}\n\n',
        'event: meta\ndata: {"music":{"title":"T","url":"/music/a.mp3","scene":"职场吐槽","reason":"配个曲儿"}}\n\n',
        'data: {"text":"你好"}\n\n',
        'data: [DONE]\n\n',
      ]),
    )

    const deltas: string[] = []
    const metas: unknown[] = []
    let session: number | null = null
    let done = false

    await readChatStream(
      { message: 'hi', session_id: null },
      new AbortController().signal,
      {
        onDelta: (t) => deltas.push(t),
        onMeta: (m) => metas.push(m),
        onSession: (id) => {
          session = id
        },
        onDone: () => {
          done = true
        },
        onError: () => undefined,
      },
    )

    expect(session).toBe(12)
    expect(metas).toEqual([
      { title: 'T', url: '/music/a.mp3', scene: '职场吐槽', reason: '配个曲儿' },
    ])
    expect(deltas).toEqual(['你好'])
    expect(done).toBe(true)
  })

  it('ignores meta frames without valid music payload', async () => {
    const { openStream } = await import('../api/client')
    vi.mocked(openStream).mockResolvedValue(
      sseResponse(['event: meta\ndata: {"foo":1}\n\n', 'data: {"text":"ok"}\n\n', 'data: [DONE]\n\n']),
    )
    const metas: unknown[] = []
    const deltas: string[] = []
    await readChatStream(
      { message: 'hi', session_id: null },
      new AbortController().signal,
      {
        onDelta: (t) => deltas.push(t),
        onMeta: (m) => metas.push(m),
        onDone: () => undefined,
        onError: () => undefined,
      },
    )
    expect(metas).toEqual([])
    expect(deltas).toEqual(['ok'])
  })
})
