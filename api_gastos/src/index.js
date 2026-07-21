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
    execSync(`fuser -k -TERM ${port}/tcp 2>/dev/null`, { stdio: 'ignore', timeout: 5000 });
    execSync(`sleep 2`, { stdio: 'ignore', timeout: 5000 });
    execSync(`fuser -k -KILL ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore', timeout: 5000 });
    execSync(`sleep 1`, { stdio: 'ignore', timeout: 5000 });
    const remain = execSync(`fuser ${port}/tcp 2>/dev/null || lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf8', timeout: 5000 }).toString().trim();
    if (remain) {
      console.log('[gastos] AVISO: Puerto', port, 'aún ocupado por:', remain);
    }
  } catch (err) {
    console.log('[gastos] Error al cerrar puerto', port, ':', err.message);
  }
}
killPort(PORT);

process.on('uncaughtException', (err, origin) => {
  console.log('[gastos] UNCAUGHT EXCEPTION:', err.message, '\n', err.stack, '\norigin:', origin);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('[gastos] UNHANDLED REJECTION:', reason instanceof Error ? reason.message : reason, '\n', reason instanceof Error ? reason.stack : '');
});

const server = app.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor gastos:', err.message);
    process.exit(1);
  }
  console.log(`Gastos service listening on port ${PORT}`);
});
