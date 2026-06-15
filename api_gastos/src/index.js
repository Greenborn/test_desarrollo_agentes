import express from 'express';
import gastosRoutes from './routes/gastos.routes.js';

const PORT = process.env.SERVICIO_GASTOS_PORT;
if (!PORT) {
  console.log('SERVICIO_GASTOS_PORT no está definido en .env');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.use('/api/gastos', gastosRoutes);

const server = app.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor gastos:', err.message);
    process.exit(1);
  }
  console.log(`Gastos service listening on port ${PORT}`);
});
