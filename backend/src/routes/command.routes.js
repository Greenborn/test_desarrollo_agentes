import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import db from '../config/db.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.get('/list-directories', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    let rawPrefix = req.query.prefix !== undefined && req.query.prefix !== '' ? req.query.prefix : '/';
    const cwd = req.query.cwd ? req.query.cwd : process.cwd();

    if (rawPrefix.startsWith('~')) {
      const home = process.env.HOME ? process.env.HOME : '/root';
      rawPrefix = rawPrefix.replace(/^~/, home);
    } else if (!rawPrefix.startsWith('/')) {
      rawPrefix = path.resolve(cwd, rawPrefix);
    }

    let dir;
    if (rawPrefix === '' || rawPrefix === '/') {
      dir = '/';
    } else if (fs.existsSync(rawPrefix) && fs.statSync(rawPrefix).isDirectory()) {
      dir = rawPrefix;
    } else {
      dir = path.dirname(rawPrefix);
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(dir, e.name))
      .filter((p) => p.startsWith(rawPrefix));

    res.json({ directories: dirs });
  } catch (err) {
    console.log('Error en list-directories:', err.message);
    res.json({ directories: [] });
  }
});

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

function buildTree(dirPath, parentPatterns, useGitignore) {
  const name = path.basename(dirPath) || dirPath
  const stat = fs.statSync(dirPath)
  const node = { name, type: stat.isDirectory() ? 'directory' : 'file', path: dirPath }
  if (stat.isDirectory()) {
    let patterns = parentPatterns
    if (useGitignore) {
      patterns = parentPatterns.concat(loadGitignore(dirPath))
    }
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      let filtered = entries.filter((e) => e.name !== '.' && e.name !== '..')
      if (useGitignore) {
        filtered = filtered.filter((e) => e.name !== '.git' && !matchesGitignore(e, dirPath, patterns))
      }
      node.children = filtered.map((e) => {
        const fullPath = path.join(dirPath, e.name)
        try {
          return buildTree(fullPath, patterns, useGitignore)
        } catch (err) {
          console.log(`Error al procesar ${fullPath}: ${err.message}`)
          return { name: e.name, type: 'error', error: err.message, path: fullPath }
        }
      })
    } catch (err) {
      console.log(`Error al leer directorio ${dirPath}: ${err.message}`)
      node.children = []
      node.error = err.message
    }
  }
  if (!stat.isDirectory()) {
    node.size = stat.size
  }
  return node
}

function pruneTree(node, extensions) {
  if (node.type === 'file') {
    const ext = path.extname(node.name).slice(1)
    return extensions.includes(ext)
  }
  if (node.type === 'directory' && node.children) {
    node.children = node.children.filter((child) => pruneTree(child, extensions))
    return node.children.length > 0
  }
  return false
}

router.get('/arbol-directorios', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const dirArg = req.query.dir || '';
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId) : null;
    const useGitignore = req.query.useGitignore !== 'false';
    const filterExtension = (req.query.filterExtension || '').replace(/^["']|["']$/g, '');
    let baseDir = process.cwd();
    if (sessionId) {
      const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      if (session && session.cwd) baseDir = session.cwd;
    }
    let targetDir;
    if (!dirArg) {
      targetDir = baseDir;
    } else if (dirArg.startsWith('~')) {
      targetDir = process.env.HOME ? dirArg.replace(/^~/, process.env.HOME) : dirArg;
    } else {
      targetDir = path.resolve(baseDir, dirArg);
    }
    if (!fs.existsSync(targetDir)) {
      return res.status(400).json({ success: false, error: `El directorio '${targetDir}' no existe` });
    }
    if (!fs.statSync(targetDir).isDirectory()) {
      return res.status(400).json({ success: false, error: `'${targetDir}' no es un directorio` });
    }
    const tree = buildTree(targetDir, [], useGitignore);
    if (filterExtension) {
      const extensions = filterExtension.split(',').map((s) => s.trim()).filter(Boolean)
      pruneTree(tree, extensions)
    }
    res.json({ success: true, tree, gitignore: useGitignore });
  } catch (err) {
    console.log('Error en arbol-directorios:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/setting/:key', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const row = await db('user_settings')
      .where({ user_id: req.session.userId, key: req.params.key })
      .first();
    res.json({ value: row ? row.value : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/setting', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { key, value } = req.body;
    await db('user_settings')
      .insert({ user_id: req.session.userId, key, value })
      .onConflict(['user_id', 'key'])
      .merge();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const query = db('command_history')
      .where({ user_id: req.session.userId });
    if (req.query.sessionId) {
      query.where({ session_id: parseInt(req.query.sessionId) });
    }
    const order = req.query.order === 'asc' ? 'asc' : 'desc';
    const rows = await query
      .orderBy('created_at', order)
      .limit(50)
      .select('command', 'created_at', 'session_id');
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ history: [], error: err.message });
  }
});

router.post('/history', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { command, sessionId } = req.body;
    const record = { user_id: req.session.userId, command };
    if (sessionId) record.session_id = sessionId;
    await db('command_history').insert(record);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/git', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { command, sessionId } = req.body;
    if (!command) {
      return res.status(400).json({ success: false, error: 'Comando git requerido' });
    }

    let cwd = process.cwd();
    if (sessionId) {
      const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      if (session && session.cwd) cwd = session.cwd;
    }

    let stdout = '';
    let stderr = '';
    let success = false;

    try {
      stdout = execSync(`git ${command}`, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      success = true;
    } catch (err) {
      stdout = err.stdout || '';
      stderr = err.stderr || err.message || 'Error desconocido';
      success = false;
    }

    if (sessionId) {
      await db('chat_messages').insert({ session_id: sessionId, role: 'command', content: `[${cwd}] /git ${command}` });
      await db('chat_messages').insert({ session_id: sessionId, role: 'result', content: success ? (stdout || '(sin salida)') : stderr });
      await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
    }

    res.json({ success, stdout, stderr });
  } catch (err) {
    console.log('Error en /git:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/git-verify', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { sessionId } = req.body;
    let cwd = process.cwd();
    if (sessionId) {
      const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      if (session && session.cwd) cwd = session.cwd;
    }
    try {
      const rootPath = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf-8' }).trim();
      res.json({ isRepo: true, rootPath, error: null });
    } catch (err) {
      res.json({ isRepo: false, rootPath: null, error: 'El directorio no es un repositorio Git.' });
    }
  } catch (err) {
    console.log('Error en git-verify:', err.message);
    res.json({ isRepo: false, rootPath: null, error: err.message });
  }
});

router.post('/git-list-branches', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { sessionId } = req.body;
    let cwd = process.cwd();
    if (sessionId) {
      const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      if (session && session.cwd) cwd = session.cwd;
    }
    try {
      const output = execSync('git branch --list', { cwd, encoding: 'utf-8' });
      const branches = output.split('\n').filter(Boolean).map(b => b.replace(/^\*?\s*/, '').trim());
      const current = output.split('\n').find(b => b.startsWith('*'));
      const currentBranch = current ? current.replace(/^\*\s*/, '').trim() : null;
      res.json({ branches, current: currentBranch, error: null });
    } catch (err) {
      console.log('Error al listar ramas:', err.message);
      res.json({ branches: [], current: null, error: err.message });
    }
  } catch (err) {
    console.log('Error en git-list-branches:', err.message);
    res.json({ branches: [], current: null, error: err.message });
  }
});

router.post('/execute', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { command, sessionId } = req.body;
  if (!command) return res.status(400).json({ error: 'Comando requerido' });

  try {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    let result = '';

    if (cmd === '/cd') {
      const dir = args.join(' ');
      if (!dir) {
        result = 'Error: debe especificar un directorio';
      } else {
        let baseDir = process.cwd();
        if (sessionId) {
          const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
          if (session && session.cwd) baseDir = session.cwd;
        }
        let resolved;
        if (dir.startsWith('~')) {
          resolved = process.env.HOME ? dir.replace(/^~/, process.env.HOME) : dir;
        } else {
          resolved = path.resolve(baseDir, dir);
        }
        if (!fs.existsSync(resolved)) {
          result = `Error: el directorio '${resolved}' no existe`;
        } else if (!fs.statSync(resolved).isDirectory()) {
          result = `Error: '${resolved}' no es un directorio`;
        } else {
          if (sessionId) {
            await db('chat_sessions').where({ id: sessionId }).update({ cwd: resolved });
          }
          result = resolved;
        }
      }
    } else if (cmd === '/ls') {
      const dirArg = args.join(' ');
      let baseDir = process.cwd();
      if (sessionId) {
        const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
        if (session && session.cwd) baseDir = session.cwd;
      }
      let targetDir;
      if (!dirArg) {
        targetDir = baseDir;
      } else if (dirArg.startsWith('~')) {
        targetDir = process.env.HOME ? dirArg.replace(/^~/, process.env.HOME) : dirArg;
      } else {
        targetDir = path.resolve(baseDir, dirArg);
      }
      if (!fs.existsSync(targetDir)) {
        result = `Error: el directorio '${targetDir}' no existe`;
      } else if (!fs.statSync(targetDir).isDirectory()) {
        result = `Error: '${targetDir}' no es un directorio`;
      } else {
        const entries = fs.readdirSync(targetDir, { withFileTypes: true });
        const lines = entries.map((e) => {
          const type = e.isDirectory() ? 'd' : '-';
          return `${type}  ${e.name}`;
        });
        result = lines.join('\n');
      }
    } else if (cmd === '/help') {
      result = 'Comando recibido — el modal de ayuda se muestra en cliente';
    } else if (cmd === '/history') {
      const rows = await db('command_history')
        .where({ user_id: req.session.userId })
        .orderBy('created_at', 'desc')
        .limit(20)
        .select('command', 'created_at');
      const formatted = rows.map((r) => `${r.created_at}: ${r.command}`).join('\n');
      result = formatted ? formatted : '(sin historial)';
    } else {
      result = `Error: comando desconocido '${cmd}'`;
    }

    if (sessionId) {
      const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      const cwd = session && session.cwd ? session.cwd : process.cwd();
      await db('chat_messages').insert({ session_id: sessionId, role: 'command', content: `[${cwd}] ${command}` });
      await db('chat_messages').insert({ session_id: sessionId, role: 'result', content: result });
      await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
    }

    const histRecord = { user_id: req.session.userId, command };
    if (sessionId) histRecord.session_id = sessionId;
    await db('command_history').insert(histRecord);

    const success = !result.startsWith('Error:');
    res.json({ success, result, command });
  } catch (err) {
    console.log('Error al ejecutar comando:', err.message);
    const errorResult = `Error: ${err.message}`;
    if (sessionId) {
      try {
        const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
        const cwd = session && session.cwd ? session.cwd : process.cwd();
        await db('chat_messages').insert({ session_id: sessionId, role: 'command', content: `[${cwd}] ${command}` });
        await db('chat_messages').insert({ session_id: sessionId, role: 'result', content: errorResult });
      } catch (innerErr) {
        console.log('Error al guardar resultado de error en chat_messages:', innerErr.message);
      }
    }
    res.status(500).json({ success: false, result: errorResult, command });
  }
});

export default router;
