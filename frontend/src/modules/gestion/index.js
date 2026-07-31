import gestionTestCommand from './commands/gestionTest.js'
import gestionExportarProyectosCommand from './commands/gestionExportarProyectos.js'

export default {
  id: 'gestion',
  name: 'Gestión Interna',
  commands: [
    gestionTestCommand,
    gestionExportarProyectosCommand,
  ],
}
