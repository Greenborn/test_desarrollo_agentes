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

router.get('/list', async (req, res) => {
  if (!authGuard(req, res)) return
  try {
    const cwd = req.query.cwd || process.cwd()
    const paths = getSkillsPaths(cwd)
    const skills = []
    const seen = new Set()

    const scanDirs = new Set()
    for (const relPath of paths) {
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

    const paths = getSkillsPaths(cwd)
    const scanDirs = new Set()
    for (const relPath of paths) {
      const resolved = path.resolve(cwd, relPath)
      if (fs.existsSync(resolved)) scanDirs.add(resolved)
      if (!relPath.endsWith('skills') && !relPath.endsWith('skills/')) {
        const withSkills = path.resolve(cwd, relPath, 'skills')
        if (fs.existsSync(withSkills)) scanDirs.add(withSkills)
      }
    }

    for (const dir of scanDirs) {
      const subdir = path.join(dir, name)
      const flat = path.join(dir, name + '.md')
      if (fs.existsSync(subdir) || fs.existsSync(flat)) {
        return res.status(400).json({ error: `El skill '${name}' ya existe` })
      }
    }

    const primaryPath = paths[0]
    const skillsDir = path.resolve(cwd, primaryPath, name)
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
