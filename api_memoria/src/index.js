import { execSync } from 'child_process';
import express from 'express';
import authMiddleware from './authMiddleware.js';
import memoriaRoutes from './routes/memoria.routes.js';

const PORT = process.env.SERVICIO_MEMORIA_PORT;
if (!PORT) {
  console.log('SERVICIO_MEMORIA_PORT no está definido en .env');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use('/api/memoria', authMiddleware, memoriaRoutes);

function killPort(port) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
  } catch {
  }
}
killPort(PORT);

const server = app.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor memoria:', err.message);
    process.exit(1);
  }
  console.log(`Memoria service listening on port ${PORT}`);
});
