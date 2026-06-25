import { execSync } from 'child_process';
import express from 'express';
import documentacionRoutes from './routes/documentacion.routes.js';

const PORT = process.env.SERVICIO_DOCUMENTAL_PORT;
if (!PORT) {
  console.log('SERVICIO_DOCUMENTAL_PORT no está definido en .env');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.use('/api/documentacion', documentacionRoutes);

function killPort(port) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
  } catch {
  }
}
killPort(PORT);

const server = app.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor documental:', err.message);
    process.exit(1);
  }
  console.log(`Documental service listening on port ${PORT}`);
});
