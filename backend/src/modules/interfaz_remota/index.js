import interfazRemotaRoutes from './interfaz_remota.routes.js';
import interfazRemotaBridgeRoutes from './interfazRemotaBridge.routes.js';

export default {
  id: 'interfaz_remota',
  name: 'Interfaz Remota',
  routes: [
    { path: '/api/interfaz-remota', router: interfazRemotaRoutes },
    { path: '/internal/interfaz-remota', router: interfazRemotaBridgeRoutes },
  ],
};
