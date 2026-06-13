import session from 'express-session';

const sessionStore = new session.MemoryStore();

const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
});

export default sessionMiddleware;
export { sessionStore };

export function wrapSessionForSocket(io) {
  io.use((socket, next) => {
    try {
      sessionMiddleware(socket.request, {}, (err) => {
        if (err) {
          console.log('Error en sessionMiddleware:', err.message);
          return next(err);
        }
        if (!socket.request.session) {
          return next(new Error('No session created'));
        }

        const token = socket.handshake.auth?.token;
        if (token && !socket.request.session.userId) {
          sessionStore.get(token, (err2, data) => {
            if (err2) {
              console.log('Error al restaurar sesión por token:', err2.message);
              return next();
            }
            if (data?.userId) {
              try {
                socket.request.session.userId = data.userId;
                socket.request.session.username = data.username;
                socket.request.session.role = data.role;
                socket.request.session.save(() => {});
              } catch (err3) {
                console.log('Error al asignar datos de sesión:', err3.message);
              }
            }
            next();
          });
        } else {
          next();
        }
      });
    } catch (err) {
      console.log('Error en wrapSessionForSocket:', err.message);
      next(err);
    }
  });
}
