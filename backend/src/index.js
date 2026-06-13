import 'dotenv/config';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import sessionMiddleware from './middlewares/sessionAuth.js';
import { wrapSessionForSocket } from './middlewares/sessionAuth.js';
import registerAuthHandlers from './socketHandlers/auth.js';
import registerChatHandlers from './socketHandlers/chat.js';
import registerSettingsHandlers from './socketHandlers/settings.js';

const app = express();
app.use(sessionMiddleware);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', credentials: true },
});

wrapSessionForSocket(io);

io.on('connection', (socket) => {
  try {
    const userId = socket.request.session?.userId;
    const username = socket.request.session?.username;

    registerAuthHandlers(io, socket, userId, username);
    registerChatHandlers(io, socket, userId);
    registerSettingsHandlers(io, socket, userId, username);
  } catch (err) {
    console.log('Error en connection handler:', err.message);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor:', err.message);
    process.exit(1);
  }
  console.log(`Server listening on port ${PORT}`);
});
