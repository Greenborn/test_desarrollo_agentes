# Skill: Agregar nuevo comando al chat

Usar cuando el usuario pida **agregar un nuevo comando** (prefijo `/`) al sistema de chat.

---

## 1. Archivo del comando

Crear en `frontend/src/composables/commands/<nombre>.js`:

```js
import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/mi_comando',
  category: 'MiCategoria',
  description: 'Breve descripción de una línea.',
  usage: '/mi_comando --param=<valor>',
  autocomplete(args, cmdStore) {
    // Opcional — ver sección 4
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params, errors } = parseCommandArgs(args, {
      param: { required: true },
    })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }

    try {
      const res = await fetch('/api/mi-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...params, sessionId }),
      })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido')
      }

      return `Resultado: ${data.resultado}`
    } catch (err) {
      console.error('Error en /mi_comando:', err.message)
      throw err
    }
  },
})
```

## 2. Registrar en `main.js`

Añadir side-effect import en `frontend/src/main.js` (orden alfabético entre los existentes):

```js
import './composables/commands/mi_comando.js'
```

## 3. Documentar en `COMANDOS.md`

Agregar fila en la tabla correspondiente dentro de `docs/COMANDOS.md`:

```markdown
| `/mi_comando` | Descripción | `/mi_comando --param=<valor>` |
```

O si es una categoría nueva, agregar bloque completo:

```markdown
---
## MiCategoria

| Comando | Descripción | Uso |
|---|---|---|
| `/mi_comando` | Descripción | `/mi_comando --param=<valor>` |
```

## 4. Patrones de autocomplete

### 4.1 Flags fijos (sin valores dinámicos)

```js
autocomplete(args, cmdStore) {
  cmdStore.showAutocomplete(['--param='])
}
```

### 4.2 Flags con datos desde API

```js
import { getUsedFlags } from '../parseCommandArgs.js'

autocomplete(args, cmdStore) {
  const usedFlags = getUsedFlags(args)
  if (usedFlags.includes('--id=')) {
    const val = args.find(a => a.startsWith('--id=')).slice('--id='.length)
    fetch('/api/items', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const prefix = val.toLowerCase()
        const filtered = data.items.filter(i => i.id.toLowerCase().includes(prefix))
        if (val && filtered.length === 1 && filtered[0].id === val) {
          cmdStore.hideAutocomplete()
        } else {
          cmdStore.showAutocomplete(filtered.map(i => ({ display: i.id, value: `--id=${i.id}` })))
        }
      })
      .catch(err => console.error('Error en autocomplete:', err))
  } else {
    cmdStore.showAutocomplete(['--id='])
  }
}
```

### 4.3 Ocultar al completar

```js
cmdStore.hideAutocomplete()
```

## 5. Reglas obligatorias

- **Prohibido `||` como fallback:** si un parámetro es requerido, validarlo explícitamente con `parseCommandArgs` y lanzar error si falta.
- **Prohibido `catch {}` vacío:** todo error debe registrarse con `console.error`.
- **Prohibido usar valores por defecto silenciosos** — si un argumento es requerido que falle con error claro.
- **Formato `--param=valor` siempre**, a excepción de comandos passthrough como `/git`.
- **Retornar string** para mostrar en el chat (Markdown soportado).  
  O **objeto de control** (`{ role: 'opencode_control', controlData: { controlType, controlId, ... } }`) para renderizar componentes interactivos inline.
- **Nunca devolver `undefined` o `null`.** Si no hay resultado significativo, retornar `'(sin resultado)'` o similar.

## 6. Despacho del comando

El flujo está en `frontend/src/components/chat/ChatWindow.vue` → `executeCommand(raw)`:
1. Detecta prefijo `/`
2. Busca en el registry con `find(cmdName)`
3. Si existe, llama a `known.execute(args, context)`
4. Si no existe, hace fallback a backend `/api/command/execute`
5. El resultado se muestra como mensaje del sistema en la sesión activa
