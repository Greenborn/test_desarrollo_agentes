import 'dotenv/config';
import express from 'express';
import commandRoutes from './routes/command.routes.js';

const PORT = process.env.SERVICIO_PLAYWRIGHT_PORT;
if (!PORT) {
  console.log('SERVICIO_PLAYWRIGHT_PORT no está definido en .env');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.use('/api', commandRoutes);

const server = app.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor playwright:', err.message);
    process.exit(1);
  }
  console.log(`Playwright service listening on port ${PORT}`);
});
