import { useModuleRegistry } from '../composables/useModuleRegistry.js'

export function initModules() {
  const { registerModule } = useModuleRegistry()
  const modules = import.meta.glob('./*/index.js', { eager: true })
  for (const [path, mod] of Object.entries(modules)) {
    const manifest = mod.default || mod
    if (manifest && manifest.id) {
      registerModule(manifest)
    }
  }
}
