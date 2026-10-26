import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

function parseGitignore(content, baseDir) {
  const patterns = []
  const lines = content.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    let pattern = line
    let negate = false
    let dirOnly = false
    if (pattern.startsWith('\\!')) {
      pattern = pattern.slice(1)
    } else if (pattern.startsWith('!')) {
      negate = true
      pattern = pattern.slice(1)
    }
    if (pattern.endsWith('/')) {
      dirOnly = true
      pattern = pattern.slice(0, -1)
    }
    if (!pattern) continue
    const anchored = pattern.includes('/')
    patterns.push({ pattern, negate, dirOnly, anchored, baseDir, regex: gitignoreToRegex(pattern) })
  }
  return patterns
}

function gitignoreToRegex(pattern) {
  let regex = ''
  let i = 0
  while (i < pattern.length) {
    const ch = pattern[i]
    if (ch === '*' && i + 1 < pattern.length && pattern[i + 1] === '*') {
      regex += '.*'
      i += 2
      if (i < pattern.length && pattern[i] === '/') i++
    } else if (ch === '*') {
      regex += '[^/]*'
      i++
    } else if (ch === '?') {
      regex += '[^/]'
      i++
    } else if (ch === '.') {
      regex += '\\.'
      i++
    } else {
      regex += ch
      i++
    }
  }
  return regex
}

function matchesGitignore(entry, dirPath, patterns) {
  if (!patterns || patterns.length === 0) return false
  const entryPath = path.join(dirPath, entry.name)
  let ignored = false
  for (const p of patterns) {
    let target
    if (p.anchored) {
      target = path.relative(p.baseDir, entryPath)
    } else {
      target = entry.name
    }
    const re = new RegExp('^' + p.regex + '$')
    if (re.test(target)) {
      if (p.dirOnly && !entry.isDirectory()) continue
      ignored = !p.negate
    }
  }
  return ignored
}

function loadGitignore(dirPath) {
  const gitignorePath = path.join(dirPath, '.gitignore')
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8')
    return parseGitignore(content, dirPath)
  }
  return []
}

const ALWAYS_SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '.next', '.cache',
  'dist', 'build', '.nyc_output', 'coverage', '__pycache__',
  '.pnpm', '.yarn',
])

async function _buildChildren(dirPath, entries, patterns, useGitignore, showHidden, maxSizeBytes, maxDepth, currentDepth) {
  let filtered = entries.filter((e) => e.name !== '.' && e.name !== '..')
  filtered = filtered.filter((e) => !(e.isDirectory() && ALWAYS_SKIP_DIRS.has(e.name)))
  if (useGitignore) {
    filtered = filtered.filter((e) => {
      if (showHidden && e.name.startsWith('.')) return true
      return !matchesGitignore(e, dirPath, patterns)
    })
  }
  return Promise.all(filtered.map(async (e) => {
    const fullPath = path.join(dirPath, e.name)
    try {
      if (e.isDirectory()) {
        return await _buildDirNode(fullPath, e.name, patterns, useGitignore, showHidden, maxSizeBytes, maxDepth, currentDepth + 1)
      }
      return await _buildFileNode(fullPath, e.name, maxSizeBytes)
    } catch (err) {
      console.log(`Error al procesar ${fullPath}: ${err.message}`)
      return { name: e.name, type: 'error', error: err.message, path: fullPath }
    }
  }))
}

export async function buildTree(dirPath, parentPatterns, useGitignore, showHidden, maxSizeBytes, maxDepth = 0, currentDepth = 0) {
  const name = path.basename(dirPath) || dirPath
  const stat = await fsp.stat(dirPath)
  const node = { name, type: stat.isDirectory() ? 'directory' : 'file', path: dirPath }
  if (stat.isDirectory()) {
    if (maxDepth > 0 && currentDepth >= maxDepth) {
      node.children = []
      return node
    }
    let patterns = parentPatterns
    if (useGitignore) {
      patterns = parentPatterns.concat(loadGitignore(dirPath))
    }
    try {
      const entries = await fsp.readdir(dirPath, { withFileTypes: true })
      node.children = await _buildChildren(dirPath, entries, patterns, useGitignore, showHidden, maxSizeBytes, maxDepth, currentDepth)
    } catch (err) {
      console.log(`Error al leer directorio ${dirPath}: ${err.message}`)
      node.children = []
      node.error = err.message
    }
  } else if (maxSizeBytes) {
    node.size = stat.size
    if (stat.size > maxSizeBytes) node.skipped = true
  }
  return node
}

async function _buildDirNode(dirPath, name, patterns, useGitignore, showHidden, maxSizeBytes, maxDepth, currentDepth) {
  const node = { name, type: 'directory', path: dirPath }
  if (maxDepth > 0 && currentDepth >= maxDepth) {
    node.children = []
    return node
  }
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true })
    node.children = await _buildChildren(dirPath, entries, patterns, useGitignore, showHidden, maxSizeBytes, maxDepth, currentDepth)
  } catch (err) {
    console.log(`Error al leer directorio ${dirPath}: ${err.message}`)
    node.children = []
    node.error = err.message
  }
  return node
}

async function _buildFileNode(dirPath, name, maxSizeBytes) {
  const node = { name, type: 'file', path: dirPath }
  if (maxSizeBytes) {
    const stat = await fsp.stat(dirPath)
    node.size = stat.size
    if (stat.size > maxSizeBytes) node.skipped = true
  }
  return node
}

export function filterTree(node, extensions, maxSizeBytes) {
  if (node.type === 'file') {
    if (node.skipped) return false
    const ext = path.extname(node.name).slice(1)
    return extensions.length === 0 || extensions.includes(ext)
  }
  if (node.type === 'directory' && node.children) {
    node.children = node.children.filter((child) => filterTree(child, extensions, maxSizeBytes))
    const hasContent = node.children.length > 0
    if (!hasContent) delete node.children
    return hasContent
  }
  return false
}

export function countTreeFiles(node) {
  if (node.type === 'file') return 1
  if (node.type === 'directory' && node.children) {
    return node.children.reduce((sum, child) => sum + countTreeFiles(child), 0)
  }
  return 0
}
