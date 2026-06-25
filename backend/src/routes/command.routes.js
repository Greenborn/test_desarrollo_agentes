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

function buildTree(dirPath, parentPatterns, useGitignore, showHidden, maxSizeBytes) {
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
        filtered = filtered.filter((e) => {
          if (e.name === '.git') return false
          if (showHidden && e.name.startsWith('.')) return true
          return !matchesGitignore(e, dirPath, patterns)
        })
      }
      node.children = filtered.map((e) => {
        const fullPath = path.join(dirPath, e.name)
        try {
          return buildTree(fullPath, patterns, useGitignore, showHidden, maxSizeBytes)
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
    if (maxSizeBytes && stat.size > maxSizeBytes) {
      node.skipped = true
    }
  }
  return node
}

function filterTree(node, extensions, maxSizeBytes) {
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

function countTreeFiles(node) {
  if (node.type === 'file') return 1
  if (node.type === 'directory' && node.children) {
    return node.children.reduce((sum, child) => sum + countTreeFiles(child), 0)
  }
  return 0
}

router.get('/arbol-directorios', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const dirArg = req.query.dir || '';
    const sessionId = req.query.sessionId ? parseInt(req.query.sessionId) : null;
    const useGitignore = req.query.useGitignore !== 'false';
    const showHidden = req.query.showHidden !== 'false';
    const filterExtension = (req.query.filterExtension || '').replace(/^["']|["']$/g, '');
    const codeExtensions = (req.query.codeExtensions || '').replace(/^["']|["']$/g, '');
    const maxSizeKb = parseInt(req.query.maxSizeKb, 10) || 0;
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
    const maxSizeBytes = maxSizeKb > 0 ? maxSizeKb * 1024 : 0;
    const tree = buildTree(targetDir, [], useGitignore, showHidden, maxSizeBytes || undefined);

    if (codeExtensions) {
      const extensions = codeExtensions.split(',').map((s) => s.trim().replace(/^\./, '')).filter(Boolean)
      filterTree(tree, extensions, maxSizeBytes || undefined)
    } else if (filterExtension) {
      const extensions = filterExtension.split(',').map((s) => s.trim()).filter(Boolean)
      filterTree(tree, extensions, maxSizeBytes || undefined)
    } else if (maxSizeBytes) {
      filterTree(tree, [], maxSizeBytes)
    }

    const totalFiles = countTreeFiles(tree)
    res.json({ success: true, tree, totalFiles, gitignore: useGitignore });
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

router.post('/git-log-graph', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { sessionId, maxCount = 100 } = req.body;
    let cwd = process.cwd();
    if (sessionId) {
      const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      if (session && session.cwd) cwd = session.cwd;
    }
    try {
      const stdout = execSync(`git log --graph --oneline --all --decorate -${maxCount}`, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      res.json({ success: true, graph: stdout, error: null });
    } catch (err) {
      res.json({ success: false, graph: '', error: err.stderr || err.message });
    }
  } catch (err) {
    console.log('Error en /git-log-graph:', err.message);
    res.status(500).json({ success: false, graph: '', error: err.message });
  }
});

router.post('/git-log-structured', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { sessionId, maxCount = 100 } = req.body;
    let cwd = process.cwd();
    if (sessionId) {
      const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      if (session && session.cwd) cwd = session.cwd;
    }

    const logStdout = execSync(
      `git log --all --format="%H|%h|%s|%an|%ad|%P|%D" --date=short -${maxCount} --topo-order`,
      { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    const commits = [];
    for (const line of logStdout.trim().split('\n')) {
      if (!line) continue;
      const parts = line.split('|');
      const [hash, shortHash, message, author, date, parentHashes, refs] = parts;
      const parents = parentHashes ? parentHashes.trim().split(/\s+/) : [];
      const refNames = refs ? refs.split(', ').map(r => r.trim()).filter(Boolean) : [];
      const branches = [];
      const tags = [];
      let isHead = false;
      for (const ref of refNames) {
        if (ref === 'HEAD') { isHead = true; continue; }
        if (ref.startsWith('tag: ')) { tags.push(ref.replace('tag: ', '')); continue; }
        if (ref.startsWith('HEAD -> ')) { isHead = true; branches.push(ref.replace('HEAD -> ', '')); continue; }
        branches.push(ref);
      }
      commits.push({ hash, shortHash, message, author, date, parents, branches, tags, isHead });
    }

    let branchList = [];
    try {
      const branchStdout = execSync('git branch --list', { cwd, encoding: 'utf-8' });
      branchList = branchStdout.split('\n').filter(Boolean).map(line => {
        const isCurrent = line.startsWith('*');
        return { name: line.replace(/^\*\s*/, '').trim(), isCurrent };
      });
    } catch (e) { /* ignore */ }

    let tagCommits = [];
    try {
      const tagStdout = execSync(
        'git for-each-ref refs/tags --format="%(refname:short)|%(objectname)"',
        { cwd, encoding: 'utf-8' }
      );
      tagCommits = tagStdout.split('\n').filter(Boolean).map(line => {
        const [name, commitHash] = line.split('|');
        return { name, commitHash };
      });
    } catch (e) { /* ignore */ }

    res.json({ success: true, commits, branches: branchList, tags: tagCommits, error: null });
  } catch (err) {
    console.log('Error en /git-log-structured:', err.message);
    res.status(500).json({ success: false, commits: [], branches: [], tags: [], error: err.message });
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

    const histRecord = { user_id: req.session.userId, command };
    if (sessionId) histRecord.session_id = sessionId;
    await db('command_history').insert(histRecord);

    const success = !result.startsWith('Error:');
    res.json({ success, result, command });
  } catch (err) {
    console.log('Error al ejecutar comando:', err.message);
    const errorResult = `Error: ${err.message}`;
    res.status(500).json({ success: false, result: errorResult, command });
  }
});

router.post('/git-merge', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { sessionId, ambienteName, mensaje, comentar } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId es requerido' });
    }
    if (!ambienteName) {
      return res.status(400).json({ success: false, error: 'ambienteName es requerido' });
    }

    const wsIds = req.session.workspaceIds || [1];

    const env = await db('workspace_environments')
      .whereIn('workspace_id', wsIds)
      .where({ name: ambienteName })
      .first();
    if (!env) {
      return res.status(400).json({ success: false, error: `Ambiente "${ambienteName}" no encontrado` });
    }

    const session = await db('chat_sessions').where({ id: sessionId }).select('cwd', 'id_ticket_redmine').first();
    if (!session) {
      return res.status(400).json({ success: false, error: 'Sesión de chat no encontrada' });
    }
    const cwd = session.cwd || process.cwd();

    try {
      execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf-8' });
    } catch (e) {
      return res.status(400).json({ success: false, error: 'El directorio no es un repositorio Git.' });
    }

    try {
      const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8' }).trim();
      if (status) {
        return res.status(400).json({ success: false, error: 'Hay cambios sin confirmar. Confirme o descarte los cambios antes de continuar.' });
      }
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Error al verificar el estado de Git: ' + (e.stderr || e.message) });
    }

    let sourceBranch;
    try {
      sourceBranch = execSync('git branch --show-current', { cwd, encoding: 'utf-8' }).trim();
      if (!sourceBranch) {
        return res.status(400).json({ success: false, error: 'No se pudo determinar la rama actual.' });
      }
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Error al obtener la rama actual: ' + (e.stderr || e.message) });
    }

    const targetBranch = env.branch;

    if (sourceBranch === targetBranch) {
      return res.status(400).json({ success: false, error: `Ya está en la rama "${targetBranch}". No se puede hacer merge de sí misma.` });
    }

    try {
      execSync('git fetch origin', { cwd, encoding: 'utf-8' });
    } catch (e) {
      console.log('[git-merge] fetch warning:', e.stderr || e.message);
    }

    let mergeOutput = '';
    let hasConflicts = false;
    let checkoutOutput = '';

    try {
      checkoutOutput = execSync(`git checkout "${targetBranch}"`, { cwd, encoding: 'utf-8' });
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Error al hacer checkout: ' + (e.stderr || e.message) });
    }

    try {
      mergeOutput = execSync(`git merge "${sourceBranch}" -m "${(mensaje || 'Merge').replace(/"/g, '\\"')}"`, { cwd, encoding: 'utf-8' });
    } catch (e) {
      const stderr = e.stderr || '';
      const stdout = e.stdout || '';
      if (stderr.includes('CONFLICT') || stdout.includes('CONFLICT') || stderr.includes('merge conflict') || stdout.includes('Automatic merge failed')) {
        hasConflicts = true;
        mergeOutput = stdout + '\n' + stderr;
      } else {
        return res.status(500).json({ success: false, error: 'Error en merge: ' + (stderr || e.message) });
      }
    }

    if (hasConflicts) {
      return res.json({
        success: true,
        hasConflicts: true,
        mergeOutput: mergeOutput.trim(),
        checkoutOutput: checkoutOutput.trim(),
        targetBranch,
        sourceBranch,
        instruction: 'El merge tiene conflictos. Resuélvalos manualmente con git add + git commit, o cancele con git merge --abort.',
      });
    }

    let pushOutput = '';
    let pushError = '';
    try {
      pushOutput = execSync(`git push origin "${targetBranch}"`, { cwd, encoding: 'utf-8' });
    } catch (e) {
      pushError = e.stderr || e.message;
      console.log('[git-merge] push warning:', pushError);
    }

    let redmineComment = null;
    const ticketId = session.id_ticket_redmine;

    const wsId = env.workspace_id || wsIds[0] || 1;
    if (ticketId && comentar) {
      const commentText = mensaje || `Se actualiza ambiente ${ambienteName}`;
      try {
        if (comentar === 'enviar') {
          const { getRedmineToken, getRedmineUrl } = await import('../services/redmine.js');
          const token = await getRedmineToken(wsId);
          const url = await getRedmineUrl(wsId);
          if (token && url) {
            const baseUrl = url.replace(/\/+$/, '');
            const rmRes = await fetch(`${baseUrl}/issues/${ticketId}.json`, {
              method: 'PUT',
              headers: {
                'X-Redmine-API-Key': token,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ issue: { notes: commentText } }),
            });
            if (rmRes.ok) {
              redmineComment = { action: 'enviado', ticketId };
            } else {
              const errText = await rmRes.text();
              console.log('[git-merge] error al enviar comentario Redmine:', errText.slice(0, 300));
              redmineComment = { action: 'error', ticketId, error: errText.slice(0, 300) };
            }
          } else {
            redmineComment = { action: 'error', ticketId, error: 'Redmine no configurado' };
          }
        } else if (comentar === 'encolar') {
          const [insertedId] = await db('redmine_comentarios').insert({
            session_id: sessionId,
            ticket_redmine_id: ticketId,
            comentario: commentText,
            workspace_id: wsId,
            estado: 'pendiente',
          });
          redmineComment = { action: 'encolado', ticketId, commentId: insertedId };
        }
      } catch (err) {
        console.log('[git-merge] error en comentario Redmine:', err.message);
        redmineComment = { action: 'error', ticketId, error: err.message };
      }
    }

    const response = {
      success: true,
      hasConflicts: false,
      mergeOutput: mergeOutput.trim(),
      pushOutput: pushOutput.trim() || null,
      targetBranch,
      sourceBranch,
    };
    if (pushError) response.pushError = pushError.trim();
    if (redmineComment) response.redmineComment = redmineComment;

    res.json(response);
  } catch (err) {
    console.log('Error en git-merge:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/git-diff-branches', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { sessionId, sourceEnv, targetEnv } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId es requerido' });
    }
    if (!sourceEnv || !targetEnv) {
      return res.status(400).json({ success: false, error: 'sourceEnv y targetEnv son requeridos' });
    }

    const chatSession = await db('chat_sessions').where({ id: sessionId }).select('workspace_id').first();
    const wsId = chatSession?.workspace_id || 1;
    const wsIds = [wsId];

    const source = await db('workspace_environments')
      .whereIn('workspace_id', wsIds)
      .where({ name: sourceEnv })
      .first();
    if (!source) {
      return res.status(400).json({ success: false, error: `Ambiente "${sourceEnv}" no encontrado` });
    }

    const target = await db('workspace_environments')
      .whereIn('workspace_id', wsIds)
      .where({ name: targetEnv })
      .first();
    if (!target) {
      return res.status(400).json({ success: false, error: `Ambiente "${targetEnv}" no encontrado` });
    }

    const sourceBranch = source.branch;
    const targetBranch = target.branch;

    if (sourceBranch === targetBranch) {
      return res.json({ success: true, commits: [], sourceEnv, targetEnv, sourceBranch, targetBranch, remoteUrl: null, message: 'Ambos ambientes usan la misma rama.' });
    }

    const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
    if (!session) {
      return res.status(400).json({ success: false, error: 'Sesión de chat no encontrada' });
    }
    const cwd = session.cwd || process.cwd();

    try {
      execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf-8' });
    } catch (e) {
      return res.status(400).json({ success: false, error: 'El directorio no es un repositorio Git.' });
    }

    let remoteUrl = null;
    try {
      const remote = execSync('git remote get-url origin', { cwd, encoding: 'utf-8' }).trim();
      let host = null, path = null;
      if (/^git@/.test(remote)) {
        const m = remote.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
        if (m) { host = m[1]; path = m[2]; }
      } else if (/^ssh:\/\//.test(remote)) {
        const m = remote.match(/^ssh:\/\/[^@]*@([^\/:]+)(?::\d+)?\/(.+?)(?:\.git)?$/);
        if (m) { host = m[1]; path = m[2]; }
      } else if (/^https?:\/\//.test(remote)) {
        const m = remote.match(/^https?:\/\/([^\/]+)\/(.+?)(?:\.git)?$/);
        if (m) { host = m[1]; path = m[2]; }
      } else if (/^git:\/\//.test(remote)) {
        const m = remote.match(/^git:\/\/([^\/]+)\/(.+?)(?:\.git)?$/);
        if (m) { host = m[1]; path = m[2]; }
      }
      if (host && path) {
        remoteUrl = `https://${host}/${path}`;
      }
    } catch (e) {
      console.log('[git-diff-branches] no se pudo obtener remote URL:', e.message);
    }

    const logOutput = execSync(
      `git log --left-right --format="%m|||%H|||%h|||%B|||%an|||%ad|||END|||" --date=short --date-order --reverse "${sourceBranch}"..."${targetBranch}"`,
      { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    const commits = [];
    const records = logOutput.split('|||END|||').filter(r => r.trim());
    for (const rec of records) {
      const parts = rec.split('|||');
      if (parts.length < 6) continue;

      const marker = parts[0].trim();
      const hash = parts[1];
      const shortHash = parts[2];
      const fullMessage = parts[3].trim();
      const author = parts[4];
      const date = parts[5];

      const side = marker === '<' ? 'left' : marker === '>' ? 'right' : 'unknown';
      const githubUrl = remoteUrl ? `${remoteUrl}/commit/${hash}` : null;

      const firstNewline = fullMessage.indexOf('\n');
      let message, body;
      if (firstNewline === -1) {
        message = fullMessage;
        body = '';
      } else {
        message = fullMessage.slice(0, firstNewline);
        body = fullMessage.slice(firstNewline + 1).trim();
      }

      commits.push({ hash, shortHash, message, body, fullMessage, author, date, side, githubUrl });
    }

    res.json({
      success: true,
      commits,
      sourceEnv,
      targetEnv,
      sourceBranch,
      targetBranch,
      remoteUrl,
      sourceLabel: source.description || sourceEnv,
      targetLabel: target.description || targetEnv,
    });
  } catch (err) {
    console.log('Error en git-diff-branches:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/read-file', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'El parámetro path es requerido' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: `El archivo '${filePath}' no existe` });
    }
    if (!fs.statSync(filePath).isFile()) {
      return res.status(400).json({ success: false, error: `'${filePath}' no es un archivo` });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ success: true, content, path: filePath });
  } catch (err) {
    console.log('Error en read-file:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/write-file', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'El campo path es requerido' });
    }
    if (content === undefined || content === null) {
      return res.status(400).json({ success: false, error: 'El campo content es requerido' });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ success: true, path: filePath });
  } catch (err) {
    console.log('Error en write-file:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
