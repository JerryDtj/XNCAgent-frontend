import { CHAT_API } from '../config/api'
import { request } from './client'

export type UserSettings = {
  music_enabled: boolean
}

export function getSettings() {
  return request<UserSettings>(CHAT_API.settings)
}

export function putSettings(music_enabled: boolean) {
  return request<UserSettings>(CHAT_API.settings, {
    method: 'PUT',
    body: JSON.stringify({ music_enabled }),
  })
}
