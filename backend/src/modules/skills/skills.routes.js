import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../../config/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OPENCODE_DEV_DIR = path.resolve(__dirname, '../../../../opencode_dev')

const router = Router()

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'No autorizado' })
    return false
  }
  return true
}

function getSkillsPaths(cwd) {
  const configPath = path.resolve(cwd, '.opencode', 'opencode.json')
  const defaultPaths = ['.opencode/skills', '.agents/skills']
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      if (Array.isArray(config.skills?.paths) && config.skills.paths.length > 0) {
        return config.skills.paths
      }
    }
  } catch (e) {
    console.log('Error reading opencode config:', e.message)
  }
  return defaultPaths
}

function scanSkills(cwd, scanPaths) {
  const skills = []
  const seen = new Set()

  const scanDirs = new Set()
  for (const relPath of scanPaths) {
    const resolved = path.resolve(cwd, relPath)
    if (fs.existsSync(resolved)) scanDirs.add(resolved)
    if (!relPath.endsWith('skills') && !relPath.endsWith('skills/')) {
      const withSkills = path.resolve(cwd, relPath, 'skills')
      if (fs.existsSync(withSkills)) scanDirs.add(withSkills)
    }
  }

  for (const skillsDir of scanDirs) {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name, 'SKILL.md')
        if (fs.existsSync(skillPath) && fs.statSync(skillPath).isFile() && !seen.has(entry.name)) {
          skills.push({ name: entry.name, path: skillPath })
          seen.add(entry.name)
        }
      } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'SKILL.md') {
        const name = entry.name.slice(0, -3)
        if (!seen.has(name)) {
          skills.push({ name, path: path.join(skillsDir, entry.name) })
          seen.add(name)
        }
      }
    }
  }

  return skills
}

router.get('/list', async (req, res) => {
  if (!authGuard(req, res)) return
  try {
    const cwd = req.query.cwd || process.cwd()
    let workspaceIds = []
    if (req.query.workspace_id) {
      workspaceIds = [parseInt(req.query.workspace_id, 10)]
    } else {
      workspaceIds = req.session?.workspaceIds || []
    }

    const projPaths = getSkillsPaths(cwd)
    let projectSkills = scanSkills(cwd, projPaths).map(s => ({ ...s, source: 'project' }))

    const projectNames = new Set(projectSkills.map(s => s.name))
    const allSkills = [...projectSkills]

    let hasWorkspaceRepo = false
    for (const wsId of workspaceIds) {
      const ws = await db('workspaces').where({ id: wsId }).select('slug').first()
      if (ws && ws.slug) {
        const repoDir = path.join(OPENCODE_DEV_DIR, ws.slug)
        if (fs.existsSync(repoDir)) {
          hasWorkspaceRepo = true
          const wsPaths = getSkillsPaths(repoDir)
          const wsSkills = scanSkills(repoDir, wsPaths)
          for (const s of wsSkills) {
            if (!projectNames.has(s.name)) {
              allSkills.push({ ...s, source: 'workspace' })
            }
          }
        }
      }
    }

    allSkills.sort((a, b) => a.name.localeCompare(b.name))
    res.json({ skills: allSkills, hasWorkspaceRepo })
  } catch (err) {
    console.log('Error en skills/list:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/create', async (req, res) => {
  if (!authGuard(req, res)) return
  try {
    const { name, cwd } = req.body
    let { target } = req.body
    if (!name || !cwd) {
      return res.status(400).json({ error: 'name y cwd requeridos' })
    }

    target = target || 'project'
    let workspaceId = req.body.workspace_id ? parseInt(req.body.workspace_id, 10) : null
    if (!workspaceId) {
      const wsIds = req.session?.workspaceIds || []
      if (wsIds.length > 0) workspaceId = wsIds[0]
    }

    if (target === 'workspace') {
      if (!workspaceId) {
        return res.status(400).json({ error: 'workspace_id requerido para crear skill de ambiente' })
      }
      const ws = await db('workspaces').where({ id: workspaceId }).select('slug').first()
      if (!ws || !ws.slug) {
        return res.status(400).json({ error: 'Workspace no encontrado' })
      }
      const repoDir = path.join(OPENCODE_DEV_DIR, ws.slug)
      if (!fs.existsSync(repoDir)) {
        return res.status(400).json({ error: 'El repositorio de skills no está clonado. Configure y clone primero en Ajustes.' })
      }
      const wsPaths = getSkillsPaths(repoDir)
      const existing = scanSkills(repoDir, wsPaths).find(s => s.name === name)
      if (existing) {
        return res.status(400).json({ error: `El skill '${name}' ya existe en el repositorio de ambiente` })
      }
      const primaryPath = wsPaths[0]
      const skillsDir = path.resolve(repoDir, primaryPath, name)
      fs.mkdirSync(skillsDir, { recursive: true })
      const skillPath = path.join(skillsDir, 'SKILL.md')
      const defaultContent = `# ${name}\n\nObjetivo: Describe aquí qué hace este skill\n\nReglas:\n- \n\nFlujo:\n1. \n\nOutput:\n-\n`
      fs.writeFileSync(skillPath, defaultContent, 'utf-8')
      return res.json({ success: true, name, path: skillPath, source: 'workspace' })
    }

    const paths = getSkillsPaths(cwd)
    const existing = scanSkills(cwd, paths).find(s => s.name === name)
    if (existing) {
      return res.status(400).json({ error: `El skill '${name}' ya existe` })
    }

    const primaryPath = paths[0]
    const skillsDir = path.resolve(cwd, primaryPath, name)
    fs.mkdirSync(skillsDir, { recursive: true })
    const skillPath = path.join(skillsDir, 'SKILL.md')
    const defaultContent = `# ${name}\n\nObjetivo: Describe aquí qué hace este skill\n\nReglas:\n- \n\nFlujo:\n1. \n\nOutput:\n-\n`
    fs.writeFileSync(skillPath, defaultContent, 'utf-8')
    res.json({ success: true, name, path: skillPath, source: 'project' })
  } catch (err) {
    console.log('Error en skills/create:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
