import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'No autorizado' })
    return false
  }
  return true
}

router.get('/list', async (req, res) => {
  if (!authGuard(req, res)) return
  try {
    const cwd = req.query.cwd || process.cwd()
    const skillsDir = path.resolve(cwd, '.agents', 'skills')

    if (!fs.existsSync(skillsDir)) {
      return res.json({ skills: [] })
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
    const skills = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillPath = path.join(skillsDir, entry.name, 'SKILL.md')
      if (fs.existsSync(skillPath) && fs.statSync(skillPath).isFile()) {
        skills.push({
          name: entry.name,
          path: skillPath,
        })
      }
    }

    skills.sort((a, b) => a.name.localeCompare(b.name))
    res.json({ skills })
  } catch (err) {
    console.log('Error en skills/list:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/create', async (req, res) => {
  if (!authGuard(req, res)) return
  try {
    const { name, cwd } = req.body
    if (!name || !cwd) {
      return res.status(400).json({ error: 'name y cwd requeridos' })
    }
    const skillsDir = path.resolve(cwd, '.agents', 'skills', name)
    if (fs.existsSync(skillsDir)) {
      return res.status(400).json({ error: `El skill '${name}' ya existe` })
    }
    fs.mkdirSync(skillsDir, { recursive: true })
    const skillPath = path.join(skillsDir, 'SKILL.md')
    const defaultContent = `# ${name}\n\nObjetivo: Describe aquí qué hace este skill\n\nReglas:\n- \n\nFlujo:\n1. \n\nOutput:\n-\n`
    fs.writeFileSync(skillPath, defaultContent, 'utf-8')
    res.json({ success: true, name, path: skillPath })
  } catch (err) {
    console.log('Error en skills/create:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
