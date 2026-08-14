import 'dotenv/config';
import http from 'http';
import express from 'express';
import sessionMiddleware from './middlewares/memoriaSession.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import commandRoutes from './routes/command.routes.js';
import opencodeRoutes from './routes/opencode.routes.js';
import navegadorRoutes from './routes/navegador.routes.js';
import funcionalidadRoutes from './routes/funcionalidad.routes.js';
import proyectoRoutes from './routes/proyecto.routes.js';
import gastosRoutes from './routes/gastos.routes.js';
import redmineRoutes from './routes/redmine.routes.js';
import ticketsRoutes from './routes/tickets.routes.js';
import workspacesRoutes from './routes/workspaces.routes.js';
import despliegueRoutes from './routes/despliegue.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import environmentsRoutes from './routes/environments.routes.js';
import playwrightLogsRoutes from './routes/playwrightLogs.routes.js';
import stateRoutes from './routes/state.routes.js';
import gestorRoutes from './routes/gestor.routes.js';
import comandosPersonalizadosRoutes, { stopAll as stopComandosPersonalizados } from './routes/comandosPersonalizados.routes.js';
import proxyRoutes from './routes/proxy.routes.js';
import archivosRoutes, { ensureStorageDir } from './routes/archivos.routes.js';
import { loadModuleRoutes } from './loadModules.js';
import dbRoutes from './routes/db.routes.js';
import procesosRoutes from './routes/procesos.routes.js';
import opencode from './services/opencode.js';
import * as devInstanceManager from './services/devInstanceManager.js';
import memoriaClient from './services/memoriaClient.js';
import { setupFrontendWebSocket } from './services/frontendWsServer.js';
import db from './config/db.js';
import dbComandos from './config/dbComandos.js';
import dbConfig from './config/dbConfig.js';
import dbGlobalSettings from './config/dbGlobalSettings.js';
import dbUserSettings from './config/dbUserSettings.js';
import dbWorkspaceEnvironments from './config/dbWorkspaceEnvironments.js';
import dbTemplates from './config/dbTemplates.js';
import dbProjectVariables from './config/dbProjectVariables.js';
import dbCommandHistory from './config/dbCommandHistory.js';
import dbChatMessages from './config/dbChatMessages.js';
import dbFiles from './config/dbFiles.js';
import dbRedmineData from './config/dbRedmineData.js';
import dbGastos from './config/dbGastos.js';
import dbPlaywright from './config/dbPlaywright.js';
import dbFuncionalidades from './config/dbFuncionalidades.js';
import dbRedmineComentarios from './config/dbRedmineComentarios.js';
import { runMigrations } from './config/dbFactory.js';
import { fetchAllSessionRepos } from './services/gitFetchService.js';
import { initInterfazRemotaLogin } from './modules/interfaz_remota/interfaz_remota.service.js';

const PORT = process.env.PORT;
if (!PORT) {
  console.log('PORT no está definido en .env');
  process.exit(1);
}

const app = express();
app.use(sessionMiddleware);
app.use(express.json({ limit: '200mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/command', commandRoutes);
app.use('/api/opencode', opencodeRoutes);
app.use('/api/navegador', navegadorRoutes);
app.use('/api', funcionalidadRoutes);
app.use('/api', proyectoRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/redmine', redmineRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/despliegue', despliegueRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/environments', environmentsRoutes);
app.use('/api/playwright-logs', playwrightLogsRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/gestor', gestorRoutes);
app.use('/api/comandos-personalizados', comandosPersonalizadosRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/archivos', archivosRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/procesos', procesosRoutes);

async function start() {
  ensureStorageDir();
  await loadModuleRoutes(app);
  try {
    console.log('[migrate] Ejecutando migraciones de chat_messages (nueva DB)...');
    await dbChatMessages.migrate.latest();
    console.log('[migrate] Migraciones de chat_messages ejecutadas correctamente.');

    console.log('[migrate] Ejecutando migraciones de files (nueva DB)...');
    await dbFiles.migrate.latest();
    console.log('[migrate] Migraciones de files ejecutadas correctamente.');

    console.log('[migrate] Ejecutando migraciones de redmine_data (nueva DB)...');
    await dbRedmineData.migrate.latest();
    console.log('[migrate] Migraciones de redmine_data ejecutadas correctamente.');

    console.log('[migrate] Ejecutando migraciones pendientes de app.db...');
    await db.migrate.latest();
    console.log('[migrate] Migraciones de app.db ejecutadas correctamente.');

    console.log('[migrate] Ejecutando migraciones de comandos...');
    await dbComandos.migrate.latest();
    console.log('[migrate] Migraciones de comandos ejecutadas correctamente.');

    console.log('[migrate] Ejecutando migraciones de configuración...');
    await dbConfig.migrate.latest();
    console.log('[migrate] Migraciones de configuración ejecutadas correctamente.');

    await runMigrations({
      global_settings: dbGlobalSettings,
      user_settings: dbUserSettings,
      workspace_environments: dbWorkspaceEnvironments,
      templates: dbTemplates,
      project_variables: dbProjectVariables,
      command_history: dbCommandHistory,
      gastos: dbGastos,
      playwright: dbPlaywright,
      funcionalidades: dbFuncionalidades,
      redmine_comentarios: dbRedmineComentarios,
    });
  } catch (err) {
    console.log('[migrate] Error al ejecutar migraciones:', err.message, '\n', err.stack);
    process.exit(1);
  }

  const server = http.createServer(app);
  setupFrontendWebSocket(server);
  server.listen(PORT, (err) => {
    if (err) {
      console.log('Error al iniciar servidor:', err.message);
      process.exit(1);
    }
    console.log(`Server listening on port ${PORT}`);
    fetchAllSessionRepos();
    initInterfazRemotaLogin();
  });
}

start();

process.on('uncaughtException', (err, origin) => {
  console.log('[backend] UNCAUGHT EXCEPTION:', err.message, '\n', err.stack, '\norigin:', origin);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('[backend] UNHANDLED REJECTION:', reason instanceof Error ? reason.message : reason, '\n', reason instanceof Error ? reason.stack : '');
});

process.on('exit', () => {
  stopComandosPersonalizados();
  devInstanceManager.stopAll();
  opencode.stopAllServers();
});
process.on('SIGTERM', () => {
  stopComandosPersonalizados();
  devInstanceManager.stopAll();
  opencode.stopAllServers();
  process.exit(0);
});
process.on('SIGINT', () => {
  stopComandosPersonalizados();
  devInstanceManager.stopAll();
  opencode.stopAllServers();
  process.exit(0);
});
