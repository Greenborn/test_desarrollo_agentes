import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function loadModuleRoutes(app) {
  const modulesDir = path.join(__dirname, 'modules')
  if (!fs.existsSync(modulesDir)) return

  const dirs = fs.readdirSync(modulesDir, { withFileTypes: true })
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue
    const indexPath = path.join(modulesDir, dir.name, 'index.js')
    if (!fs.existsSync(indexPath)) continue

    try {
      const mod = await import(`./modules/${dir.name}/index.js`)
      const manifest = mod.default
      if (manifest && manifest.routes) {
        for (const route of manifest.routes) {
          app.use(route.path, route.router)
          console.log(`[loadModules] Montado ruta ${route.path} desde módulo ${manifest.id}`)
        }
      }
    } catch (err) {
      console.log(`[loadModules] Error cargando módulo ${dir.name}:`, err.message)
    }
  }
}
