import wsClient from './wsClient.js'
import { useAuthStore } from '../stores/auth.js'

export async function settingSet(key, value) {
  const auth = useAuthStore()
  const result = await wsClient.send('setting:set', {
    sessionToken: auth.getSessionToken(),
    key,
    value,
  })
  if (!result.success) throw new Error(result.error || 'Error al guardar setting')
  return result
}

export async function settingGet(key) {
  const auth = useAuthStore()
  const result = await wsClient.send('setting:get', {
    sessionToken: auth.getSessionToken(),
    key,
  })
  if (!result.success) throw new Error(result.error || 'Error al obtener setting')
  return { value: result.value }
}
