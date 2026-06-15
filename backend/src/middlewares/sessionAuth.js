import session from 'express-session';

if (!process.env.SESSION_SECRET) {
  console.log('SESSION_SECRET no está definido en .env');
  process.exit(1);
}

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
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
