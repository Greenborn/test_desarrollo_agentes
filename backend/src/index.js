import 'dotenv/config';
import http from 'http';
import express from 'express';
import sessionMiddleware from './middlewares/sessionAuth.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import commandRoutes from './routes/command.routes.js';
import opencodeRoutes from './routes/opencode.routes.js';
import opencode from './services/opencode.js';

const PORT = process.env.PORT;
if (!PORT) {
  console.log('PORT no está definido en .env');
  process.exit(1);
}

const app = express();
app.use(sessionMiddleware);
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/command', commandRoutes);
app.use('/api/opencode', opencodeRoutes);

const server = http.createServer(app);
server.listen(PORT, async (err) => {
  if (err) {
    console.log('Error al iniciar servidor:', err.message);
    process.exit(1);
  }
  console.log(`Server listening on port ${PORT}`);

  try {
    console.log('Iniciando opencode serve...');
    opencode.startProcess();
    await opencode.waitForReady();
    console.log(`opencode listo en puerto ${process.env.OPENCODE_PORT || 4097}`);
  } catch (e) {
    console.log('Error al iniciar opencode:', e.message);
    console.log('Podes iniciarlo manualmente con: opencode serve --port 4097');
  }
});
