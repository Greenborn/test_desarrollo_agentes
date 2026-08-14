import interfazRemotaRoutes from './interfaz_remota.routes.js';

export default {
  id: 'interfaz_remota',
  name: 'Interfaz Remota',
  routes: [
    { path: '/api/interfaz-remota', router: interfazRemotaRoutes },
  ],
};
