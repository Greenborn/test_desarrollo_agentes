---
name: crear_componente_mensaje_chat
description: Crear o modificar componentes de mensajes de chat (controles, renderizado por role). Usar cuando se pida crear un nuevo controlType, modificar ChatMessage.vue, o agregar un componente en chat-controls/.
---

# crear_componente_mensaje_chat

**Objetivo:** Crear un nuevo componente que forme parte de la vista de mensajes de una sesión de chat. Esto incluye componentes de control (`opencode_control`) renderizados dentro de `ChatMessage.vue`, o modificaciones al sistema de renderizado de mensajes según su `role`.

## Reglas generales

1. **Session-scoping obligatorio:** Todo componente que forme parte de la vista de mensajes debe estar atado a la sesión de chat activa. Nunca debe ser visible en sesiones distintas a la que lo originó. Usar `v-if` con comparación contra `activeSessionId` o contra un ID de sesión almacenado.
2. **Todo componente de mensaje debe registrarse en `ChatMessage.vue`** (frontend/src/components/chat/ChatMessage.vue). Allí se centraliza el renderizado según `msg.role`.
3. **Si es un control interactivo**, debe:
   - Tener su archivo en `frontend/src/components/chat-controls/`
   - Emitir evento `@confirm` con la selección del usuario
   - Ser importado y registrado en `ChatMessage.vue`
   - Agregar un `v-else-if` en el template para el `controlType` correspondiente
4. **Manejo de errores:** Todo `catch` debe registrar el error con `console.error`. Prohibido `catch {}` vacío o silencioso.
5. **Prohibido parámetros `||` como fallback.** Validar explícitamente cada argumento requerido y devolver error si falta.
6. **Todos los parámetros de comandos deben usar `--nombre=valor`.** No se permiten argumentos posicionales. Usar `parseCommandArgs(args, schema)` de `parseCommandArgs.js` y `getUsedFlags` para autocomplete. Las únicas excepciones documentadas son `/git` (passthrough) y `/skill_editar` (prompt libre).
7. **Estado global ≠ estado compartido entre sesiones.** Cualquier `ref` o `reactive` global (stores, módulos, composables) que controle visibilidad de un componente debe estar keyeado por `sessionId` o debe verificarse contra la sesión activa antes de renderizar.

## Roles de mensaje existentes

Cada mensaje tiene un campo `role` que determina cómo se renderiza en `ChatMessage.vue`:

| role | estilo | clase/css |
|------|--------|-----------|
| `user` | burbuja azul (`user-bubble`) | `#75AADB` bg |
| `command` | inline-block amarillo, monospace | `#1a2744` bg, `#E8B800` text |
| `result` | inline-block azul tenue | `#16213e` bg, `#75AADB` border |
| `assistant` | burbuja oscura (`assistant-bubble`) | `#1a2744` bg, `#374151` border |
| `opencode_stream` | bloque completo, con thinking colapsable + cursor `▌` blink | borde `#75AADB` |
| `opencode_result` | bloque completo, thinking colapsable, ChatFormatter | borde `#75AADB` |
| `opencode_info` | bloque completo small, texto gris | borde `#374151` |
| `opencode_confirmed` | inline-block con borde azul | `#1a2744` bg, `#75AADB` text |
| `opencode_control` | bloque con dispatch a sub-componentes según `controlType` | borde `#75AADB` |

## Cómo agregar un nuevo controlType

### Paso 1: Crear el componente en `frontend/src/components/chat-controls/`
Ejemplo mínimo:
```vue
<template>
  <div class="d-flex flex-column gap-2 p-2">
    <button class="btn btn-sm btn-outline-argentina" @click="confirm(selectedValue)">
      Confirmar
    </button>
  </div>
</template>

<script>
export default {
  emits: ['confirm'],
  props: {
    options: { type: Array, default: () => [] },
  },
  methods: {
    confirm(val) { this.$emit('confirm', val) },
  },
}
</script>
```

### Paso 2: Importar y registrar en `ChatMessage.vue`
En la sección `<script>`:
```js
import MiNuevoControl from '../chat-controls/MiNuevoControl.vue'
```
En `components:`:
```js
components: { ..., MiNuevoControl, ... }
```

### Paso 3: Agregar el `v-else-if`
En el template, dentro del bloque `v-if="msg.role === 'opencode_control'"`, agregar:
```html
<MiNuevoControl v-else-if="parsedControl && parsedControl.controlType === 'mi_tipo'"
  :prop1="parsedControl.prop1"
  @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })"
/>
```

### Paso 4 (opcional): Manejar la respuesta en `useControlHandlers.js`
Si el control requiere lógica adicional al confirmar, agregar un case en `frontend/src/composables/useControlHandlers.js` para el `stepType` o `controlType` y los datos recibidos.

## Convenciones de estilo

- Usar Bootstrap 5 clases existentes (`btn`, `d-flex`, `gap-*`, `rounded-3`, etc.)
- Paleta de colores:
  - Fondo oscuro: `#1a2744`, `#0f172a`, `#16213e`
  - Acento azul: `#75AADB`
  - Texto claro: `#e0e0e0`, `#f0f0f0`
  - Texto gris: `#9ca3af`
  - Bordes: `#374151`
- Evitar crear nuevas clases CSS globales; usar scoped styles o inline
- `font-monospace` para contenido técnico (comandos, resultados)

## Flujo de datos

1. Backend envía SSE con `control_request` → mensaje `opencode_control` se guarda en BD y store
2. `ChatWindow.vue` itera `messages` y renderiza `<ChatMessage>` por cada uno
3. `ChatMessage.vue` según `msg.role` renderiza el template adecuado
4. Para `opencode_control`, hace dispatch al componente según `controlData.controlType`
5. El componente emite `@confirm` → `ChatMessage` re-emite como `@control-confirm`
6. `ChatWindow` captura `@control-confirm` y llama a `onControlConfirm`
7. `useControlHandlers.js` procesa según `controlType`/`stepType` y genera la siguiente acción

## Output

El componente debe ser funcional y seguir el flujo establecido de eventos. El archivo debe ir en `frontend/src/components/chat-controls/` con el mismo naming (`PascalCase.vue`). Verificar con `git status` que no se modificaron archivos fuera de lo esperado.
