import 'dotenv/config';
import http from 'http';
import express from 'express';
import sessionMiddleware from './middlewares/sessionAuth.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import commandRoutes from './routes/command.routes.js';

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

const server = http.createServer(app);
server.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor:', err.message);
    process.exit(1);
  }
  console.log(`Server listening on port ${PORT}`);
});
