import almacenamientoRoutes from './almacenamiento.routes.js'

export default {
  id: 'almacenamiento',
  name: 'Almacenamiento',
  routes: [
    { path: '/api/almacenamiento', router: almacenamientoRoutes },
  ],
}
