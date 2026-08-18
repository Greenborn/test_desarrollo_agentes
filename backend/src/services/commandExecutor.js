import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import dbConfig from '../config/dbConfig.js';
import dbCommandHistory from '../config/dbCommandHistory.js';
import opencode from './opencode.js';

export async function executeBackendCommand(command, { sessionId = null, userId = null } = {}) {
  if (!command || typeof command !== 'string') {
    return { success: false, result: 'Error: comando requerido', command };
  }

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
  } else if (cmd === '/dev_opencode_iniciar') {
    if (!sessionId) {
      result = 'Error: se requiere una sesión de chat para iniciar OpenCode';
    } else {
      const session = await db('chat_sessions').where({ id: sessionId }).select('cwd', 'workspace_id').first();
      if (!session) {
        result = 'Error: sesión de chat no encontrada';
      } else if (!session.cwd) {
        result = 'Error: la sesión no tiene directorio de trabajo (cwd). Usá /cd <ruta> primero.';
      } else {
        try {
          const wsId = session.workspace_id || 1;
          const localeRow = await dbConfig('settings').where({ workspace_id: wsId, setting_key: 'locale' }).first();
          const locale = localeRow ? localeRow.setting_value : 'es_ES.UTF-8';
          const server = await opencode.getOrStartServer(session.cwd, sessionId, locale);
          const ocSession = await server.createSession('OpenCode - remoto', 'build');
          result = `✅ OpenCode iniciado en: ${session.cwd}\nInstancia OpenCode: ${ocSession.id}`;
        } catch (ocErr) {
          console.log('[commandExecutor] Error al iniciar OpenCode:', ocErr.message);
          result = `Error: no se pudo iniciar OpenCode: ${ocErr.message}`;
        }
      }
    }
  } else if (cmd === '/help') {
    result = 'Comando recibido — la ayuda se muestra en el cliente';
  } else if (cmd === '/history') {
    if (!userId) {
      result = '(sin historial)';
    } else {
      const rows = await dbCommandHistory('command_history')
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .limit(20)
        .select('command', 'created_at');
      const formatted = rows.map((r) => `${r.created_at}: ${r.command}`).join('\n');
      result = formatted ? formatted : '(sin historial)';
    }
  } else {
    result = `Error: comando desconocido '${cmd}'`;
  }

  if (sessionId) {
    await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
  }

  const success = !result.startsWith('Error:');
  return { success, result, command };
}
