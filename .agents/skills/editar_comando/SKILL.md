---
name: editar_comando
description: Editar o crear comandos del chat siguiendo las convenciones del proyecto. Usar cuando se pida modificar un comando existente, crear uno nuevo, o corregir inconsistencias en el sistema de comandos.
---

# editar_comando

**Objetivo:** Editar o crear comandos del chat respetando las convenciones del proyecto para mantener consistencia en el sistema de comandos.

## Reglas obligatorias

1. **Formato `--nombre=valor` obligatorio.** Todos los parámetros deben usar flags con `--`. Prohibido argumentos posicionales (excepciones: `/git` y `/skill_editar`).
2. **Usar `parseCommandArgs(args, schema)`** para parsear argumentos. Importar de `frontend/src/composables/parseCommandArgs.js`.
3. **Usar `getUsedFlags(args)`** para autocomplete.
4. **Autocomplete siempre con `showAutocomplete()`** (no `setAutocomplete` — ese método no existe). Importar del `cmdStore` recibido en el callback.
5. **Categorías deben coincidir con COMANDOS.md.** Si agregas un comando a una categoría existente, verificar en `docs/COMANDOS.md` que el nombre de categoría coincida. Si creas categoría nueva, agregarla también en COMANDOS.md.
6. **Documentar en COMANDOS.md.** Todo comando debe tener su fila en la tabla correspondiente de `docs/COMANDOS.md`.
7. **Prohibido `||` como fallback de parámetros.** Validar explícitamente cada argumento requerido y devolver error si falta.
8. **Manejo de errores.** Todo `catch` debe registrar el error con `console.error` (frontend) o `console.log` (backend). Prohibido `catch {}` vacío o silencioso.

## Dónde registrar comandos

### Comandos individuales (side-effect)
Archivos en `frontend/src/composables/commands/` que importan `register` desde `useCommandRegistry` y llaman `register({...})` como side-effect al importarse. Se importan en `main.js`:

```js
import './comandos/commands/miComando.js'
```

### Comandos de módulo
Archivos en `frontend/src/modules/<name>/commands/` que **exportan un objeto default** (NO llaman `register()`). Se registran automáticamente por el module registry al incluirse en el array `commands` del manifest del módulo:

```js
export default {
  name: '/mi_comando',
  category: 'MiCategoria',
  description: 'Descripción.',
  usage: '/mi_comando --flag=<valor>',
  async autocomplete(args, cmdStore) { ... },
  async execute(args, { chatStore, loadingIdx, sessionId }) { ... },
}
```

### Comandos inline (excepción — solo en Topbar.vue)
Cuando el comando requiere acceso directo al store del navegador o dependencias del layout. NO crear nuevos comandos inline sin justificación.

## Estructura del objeto comando

```js
{
  name: '/nombre_comando',       // string, con prefijo /
  category: 'Categoria',         // string, debe coincidir con COMANDOS.md
  description: 'Qué hace.',      // string, una línea
  usage: '/comando --flag=<val>', // string, con flags --nombre=valor
  autocomplete(args, cmdStore) {  // opcional: para autocompletado con Tab
    const usedFlags = getUsedFlags(args)
    // ... lógica de sugerencias
    cmdStore.showAutocomplete(suggestions)
  },
  async execute(args, { chatStore, cmdStore, loadingIdx, sessionId }) {
    // args: string[] — argumentos sin el nombre del comando
    // loadingIdx: índice del mensaje de carga en chatStore.messages
    // El return se muestra como resultado en el chat
  },
}
```

## Patrón correcto de execute

```js
async execute(args, { chatStore, loadingIdx, sessionId }) {
  if (!sessionId) {
    throw new Error('Primero debe iniciar una sesión de chat.')
  }

  const { params, errors } = parseCommandArgs(args, {
    flag1: { required: true },
    flag2: { required: false },
  })
  if (errors.length > 0) {
    throw new Error(errors.join('. '))
  }

  // ... lógica con fetch() usando credentials: 'include'

  return 'Resultado del comando'
}
```

## Patrón correcto de autocomplete

```js
async autocomplete(args, cmdStore) {
  const usedFlags = getUsedFlags(args)

  if (flagCompletado) {
    // sugerir valores para el flag
    cmdStore.showAutocomplete(valores.map(v => `--flag=${v}`))
  } else if (!usedFlags.includes('--flag')) {
    cmdStore.showAutocomplete(['--flag='])
  } else {
    cmdStore.hideAutocomplete()
  }
}
```

## Verificación post-edición

1. El comando aparece en `/help` bajo la categoría correcta
2. El autocompletado con Tab funciona para cada flag
3. La documentación en `docs/COMANDOS.md` está actualizada
4. El comando no usa argumentos posicionales
5. `category` en el código coincide exactamente con el nombre de la sección en COMANDOS.md
6. No hay `console.error` silenciado ni `catch {}` vacío
