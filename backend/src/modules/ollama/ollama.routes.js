import { Router } from 'express'
import ollamaService from '../../services/ollamaService.js'
import dbGlobalSettings from '../../config/dbGlobalSettings.js'

const router = Router()

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'No autorizado' })
    return false
  }
  return true
}

router.get('/tags', async (req, res) => {
  if (!authGuard(req, res)) return
  try {
    await ollamaService.ensureRunning()
    const response = await fetch(`${ollamaService.baseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      console.log('[ollama] Error en tags:', response.status, response.statusText)
      return res.status(200).json({ status: false, error: 'Error al obtener modelos de Ollama' })
    }
    const data = await response.json()
    res.status(200).json({ status: true, data: data.models || [] })
  } catch (err) {
    console.log('[ollama] Error al listar modelos:', err.message)
    res.status(200).json({ status: false, error: 'Error de conexión con Ollama: ' + err.message })
  }
})

router.post('/pull', async (req, res) => {
  if (!authGuard(req, res)) return
  const { name } = req.body
  if (!name) {
    return res.status(200).json({ status: false, error: 'El campo "name" es requerido' })
  }
  try {
    await ollamaService.ensureRunning()
    const response = await fetch(`${ollamaService.baseUrl()}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(300000),
    })
    if (!response.ok) {
      const text = await response.text()
      console.log('[ollama] Error en pull:', response.status, text)
      return res.status(200).json({ status: false, error: 'Error al instalar modelo: ' + (text || response.statusText) })
    }
    const data = await response.json()
    res.status(200).json({ status: true, data: { message: 'Modelo instalado correctamente', details: data } })
  } catch (err) {
    console.log('[ollama] Error al instalar modelo:', err.message)
    res.status(200).json({ status: false, error: 'Error al instalar modelo: ' + err.message })
  }
})

router.post('/delete', async (req, res) => {
  if (!authGuard(req, res)) return
  const { name } = req.body
  if (!name) {
    return res.status(200).json({ status: false, error: 'El campo "name" es requerido' })
  }
  try {
    await ollamaService.ensureRunning()
    const response = await fetch(`${ollamaService.baseUrl()}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      const text = await response.text()
      console.log('[ollama] Error en delete:', response.status, text)
      return res.status(200).json({ status: false, error: 'Error al eliminar modelo: ' + (text || response.statusText) })
    }
    const data = await response.json()
    res.status(200).json({ status: true, data: { message: 'Modelo eliminado correctamente', details: data } })
  } catch (err) {
    console.log('[ollama] Error al eliminar modelo:', err.message)
    res.status(200).json({ status: false, error: 'Error al eliminar modelo: ' + err.message })
  }
})

router.get('/config', async (req, res) => {
  if (!authGuard(req, res)) return
  try {
    const row = await dbGlobalSettings('global_settings').where({ setting_key: 'ollama_commit_model' }).first()
    res.status(200).json({ status: true, data: { commitModel: row ? row.setting_value : '' } })
  } catch (err) {
    console.log('[ollama] Error al leer config:', err.message)
    res.status(200).json({ status: false, error: err.message })
  }
})

router.post('/config', async (req, res) => {
  if (!authGuard(req, res)) return
  const { commitModel } = req.body
  if (commitModel === undefined) {
    return res.status(200).json({ status: false, error: 'El campo "commitModel" es requerido' })
  }
  try {
    const value = commitModel ? String(commitModel) : ''
    await dbGlobalSettings('global_settings')
      .insert({ setting_key: 'ollama_commit_model', setting_value: value })
      .onConflict('setting_key')
      .merge()
    res.status(200).json({ status: true, data: { message: 'Configuración guardada' } })
  } catch (err) {
    console.log('[ollama] Error al guardar config:', err.message)
    res.status(200).json({ status: false, error: err.message })
  }
})

export default router
