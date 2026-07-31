import gestionRoutes from './gestion.routes.js';

export default {
  id: 'gestion',
  name: 'Gestión Interna',
  routes: [
    { path: '/api/gestion', router: gestionRoutes },
  ],
};
