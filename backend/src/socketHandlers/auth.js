import bcrypt from 'bcrypt';
import db from '../config/db.js';

function emitMe(socket) {
  try {
    const sid = socket.request.session?.userId;
    const sname = socket.request.session?.username;
    if (sid) {
      socket.emit('auth:me', { id: sid, username: sname });
      socket.emit('auth:session', { token: socket.request.session.id });
    } else {
      socket.emit('auth:me', null);
    }
  } catch (err) {
    console.log('Error en emitMe:', err.message);
  }
}

export default function registerAuthHandlers(io, socket, userId, username) {
  emitMe(socket);

  socket.on('auth:me', () => {
    try {
      emitMe(socket);
    } catch (err) {
      console.log('Error en auth:me:', err.message);
    }
  });

  socket.on('auth:login', async ({ username, password }) => {
    try {
      const users = await db('users').where({ username });
      if (!users.length) {
        return socket.emit('auth:login_res', { success: false, error: 'Credenciales inválidas' });
      }
      const user = users[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return socket.emit('auth:login_res', { success: false, error: 'Credenciales inválidas' });
      }
      socket.request.session.userId = user.id;
      socket.request.session.username = user.username;
      socket.request.session.role = user.role;
      await new Promise((resolve) => socket.request.session.save(resolve));
      socket.emit('auth:session', { token: socket.request.session.id });
      socket.emit('auth:me', { id: user.id, username: user.username, role: user.role });
      socket.emit('auth:login_res', { success: true, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
      console.log('Error en auth:login:', err.message);
      socket.emit('auth:login_res', { success: false, error: 'Error interno' });
    }
  });

  socket.on('auth:logout', async () => {
    try {
      await new Promise((resolve) => socket.request.session.destroy(resolve));
      socket.emit('auth:session', { token: null });
      emitMe(socket);
    } catch (err) {
      console.log('Error en auth:logout:', err.message);
    }
  });
}
