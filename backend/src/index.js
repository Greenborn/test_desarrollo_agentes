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
import documentacionRoutes from './routes/documentacion.routes.js';
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
app.use('/api/documentacion', documentacionRoutes);
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
    console.log('[migrate] Ejecutando migraciones pendientes...');
    await db.migrate.latest();
    console.log('[migrate] Migraciones ejecutadas correctamente.');
  } catch (err) {
    console.log('[migrate] Error al ejecutar migraciones:', err.message);
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
  });
}

start();

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
