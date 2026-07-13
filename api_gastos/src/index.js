import { execSync } from 'child_process';
import express from 'express';
import gastosRoutes from './routes/gastos.routes.js';

const PORT = process.env.SERVICIO_GASTOS_PORT;
if (!PORT) {
  console.log('SERVICIO_GASTOS_PORT no está definido en .env');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '200mb' }));

app.use('/api/gastos', gastosRoutes);

function killPort(port) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
  } catch (err) {
    console.log('[gastos] Error al matar puerto:', err.message);
  }
}
killPort(PORT);

const server = app.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor gastos:', err.message);
    process.exit(1);
  }
  console.log(`Gastos service listening on port ${PORT}`);
});
