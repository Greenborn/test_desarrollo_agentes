---
name: agregar_plugin
description: Crear un nuevo módulo/plugin auto-registrable para el sistema de módulos. Hace preguntas interactivas sobre todos los parámetros que no se proporcionen y genera el código completo: manifest, componentes, comandos, rutas backend, migraciones, seeds, menú lateral y rutas Vue Router.
requires: []
---

# Skill: Agregar Plugin (Módulo)

**Objetivo:** Crear un nuevo módulo auto-registrable en el sistema de módulos del proyecto. Este skill hace preguntas interactivas para determinar qué necesita el plugin y genera todo el código necesario.

## Diferencia con crear_modulo

| Skill | Enfoque |
|-------|---------|
| `crear_modulo` | **Referencial/documental:** describe formatos y reglas del sistema de módulos |
| `agregar_plugin` | **Interactivo/procedimental:** hace preguntas al usuario y genera el código completo |

Usar `agregar_plugin` cuando se pida crear un plugin o módulo nuevo y se quiera generar el código paso a paso interactivamente. Usar `crear_modulo` como referencia de formato cuando ya se sabe qué crear.

---

## 0. Verificar si hay parámetros pre-proporcionados

Antes de preguntar, verificar si el usuario ya proporcionó algunos parámetros en su solicitud. Si algún valor ya está definido, usarlo directamente sin preguntar.

Posibles parámetros pre-proporcionados:
- `id` del módulo (snake_case)
- `name` legible
- `panel` destino (sidebarRight, sidebarChat, devPanel)
- `tabLabel` / `tabPriority`
- `commands` (lista de comandos)
- `backend` (boolean o descripción)
- `dbTable` (nombre de tabla)

---

## 1. Preguntar datos base del plugin

Solo preguntar si el usuario no los proporcionó.

```
<question>
Pregunta: ID del plugin (snake_case, único, ej: notificaciones, exportador_pdf)
Header: ID del plugin
</question>
```

```
<question>
Pregunta: Nombre legible del plugin (ej: Notificaciones, Exportador PDF)
Header: Nombre legible
</question>
```

---

## 2. Preguntar componentes del plugin

Preguntar uno por uno qué incluye el plugin. Solo preguntar si el usuario no lo especificó.

### 2.1 ¿Requiere backend?

```
<question>
Pregunta: ¿El plugin requiere rutas API en el backend?
Header: Backend API
Options:
  - Si (Recommended)
  - No, solo frontend
</question>
```

### 2.2 ¿Requiere base de datos?

Si respuesta es `Si` en backend:

```
<question>
Pregunta: ¿El plugin requiere tablas en la base de datos?
Header: Base de datos
Options:
  - Si (Recommended)
  - No
</question>
```

Si `Si`:

```
<question>
Pregunta: Nombre de la tabla (snake_case, ej: notificaciones, exportaciones)
Header: Nombre de tabla
</question>
```

```
<question>
Pregunta: ¿La tabla ya existe en la base de datos?
Header: Tabla existente
Options:
  - No, crear tabla nueva (Recommended)
  - Si, ya existe
</question>
```

### 2.3 ¿Requiere tabs?

```
<question>
Pregunta: ¿El plugin agrega un tab en algún panel?
Header: Tabs en panel
Options:
  - Si (Recommended)
  - No
</question>
```

Si `Si`:

```
<question>
Pregunta: ¿En qué panel va el tab?
Header: Panel destino
Options:
  - sidebarRight (Panel derecho)
  - sidebarChat (Panel izquierdo)
  - devPanel (Panel inferior)
</question>
```

```
<question>
Pregunta: Label del tab (ej: Notificaciones, Exportaciones)
Header: Label del tab
</question>
```

```
<question>
Pregunta: Prioridad del tab (número, menor = más a la izquierda/arriba)
Header: Prioridad del tab
</question>
```

### 2.4 ¿Requiere comandos de chat?

```
<question>
Pregunta: ¿El plugin agrega comandos al chat?
Header: Comandos de chat
Options:
  - Si
  - No (Recommended)
</question>
```

Si `Si`, preguntar por cada comando. Primero preguntar cuántos:

```
<question>
Pregunta: ¿Cuántos comandos agregará el plugin?
Header: Número de comandos
</question>
```

Luego para cada comando `i` de 1 a N:

```
<question>
Pregunta: Nombre del comando <i> (con prefijo /, ej: /notif_listar, /pdf_generar)
Header: Comando <i> - nombre
</question>
```

```
<question>
Pregunta: Categoría del comando <i> (ej: Notificaciones, Exportacion)
Header: Comando <i> - categoría
</question>
```

```
<question>
Pregunta: Descripción breve del comando <i> (qué hace)
Header: Comando <i> - descripción
</question>
```

```
<question>
Pregunta: Flags del comando <i> separadas por coma (ej: --id,--tipo,--formato). Dejar vacío si no tiene flags.
Header: Comando <i> - flags
</question>
```

Para cada flag, preguntar:

```
<question>
Pregunta: ¿La flag <flag> es requerida?
Header: Flag requerida
Options:
  - Si
  - No (Recommended)
</question>
```

> Guardar comandos como array `<comandos>` con: `{name, category, description, flags: [{nombre, requerido}]}`

### 2.5 ¿Requiere menú lateral?

```
<question>
Pregunta: ¿Deseas agregar un enlace en el menú lateral para este plugin?
Header: Menú lateral
Options:
  - Si (Recommended)
  - No
</question>
```

Si `Si`:

```
<question>
Pregunta: Label del enlace en el menú (ej: Notificaciones, Exportar PDF)
Header: Menú - label
</question>
```

```
<question>
Pregunta: Icono Bootstrap para el menú (ej: bi-bell, bi-file-earmark-pdf, bi-gear)
Header: Menú - icono
</question>
```

```
<question>
Pregunta: Prefijo de permiso para el menú (ej: notificaciones.ver, exportacion.ver)
Header: Menú - permiso
</question>
```

### 2.6 ¿Requiere ruta Vue Router independiente?

```
<question>
Pregunta: ¿El plugin tiene una vista independiente accesible por ruta (ej: /notificaciones)?
Header: Ruta Vue Router
Options:
  - Si
  - No (Recommended)
</question>
```

Si `Si`:

```
<question>
Pregunta: Path de la ruta (ej: /notificaciones, /exportar)
Header: Ruta - path
</question>
```

```
<question>
Pregunta: Nombre de la ruta en Vue Router (ej: notificaciones, exportar)
Header: Ruta - nombre
</question>
```

---

## 3. Almacenar respuestas

Guardar todas las respuestas con los siguientes nombres de variable para usarlas en la generación de código:

| Variable | Origen |
|----------|--------|
| `<plugin_id>` | paso 1 |
| `<plugin_name>` | paso 1 |
| `<tiene_backend>` | paso 2.1 |
| `<tiene_bd>` | paso 2.2 |
| `<tabla_bd>` | paso 2.2 (si tiene BD) |
| `<tabla_existe>` | paso 2.2 (si tiene BD) |
| `<tiene_tabs>` | paso 2.3 |
| `<tab_panel>` | paso 2.3 (sidebarRight/sidebarChat/devPanel) |
| `<tab_label>` | paso 2.3 |
| `<tab_priority>` | paso 2.3 |
| `<tiene_comandos>` | paso 2.4 |
| `<comandos>` | paso 2.4 (array) |
| `<tiene_menu>` | paso 2.5 |
| `<menu_label>` | paso 2.5 |
| `<menu_icono>` | paso 2.5 |
| `<menu_permiso>` | paso 2.5 |
| `<tiene_ruta>` | paso 2.6 |
| `<ruta_path>` | paso 2.6 |
| `<ruta_name>` | paso 2.6 |

---

## 4. Generar estructura de directorios

Crear los directorios necesarios:

```bash
mkdir -p "frontend/src/modules/<plugin_id>/components"
```

Si `<tiene_comandos>` = `Si`:
```bash
mkdir -p "frontend/src/modules/<plugin_id>/commands"
```

Si `<tiene_backend>` = `Si`:
```bash
mkdir -p "backend/src/modules/<plugin_id>"
```

---

## 5. Generar manifest frontend

Crear `frontend/src/modules/<plugin_id>/index.js`:

```javascript
<SI_TIENE_COMANDOS>
import comando1 from './commands/comando1.js'
</SI_TIENE_COMANDOS>

export default {
  id: '<plugin_id>',
  name: '<plugin_name>',
  <SI_TIENE_TABS>
  tabs: {
    <tab_panel>: [
      {
        id: '<plugin_id>',
        label: '<tab_label>',
        component: () => import('./components/<plugin_id>Tab.vue'),
        priority: <tab_priority>,
      },
    ],
  },
  </SI_TIENE_TABS>
  <SI_TIENE_COMANDOS>
  commands: [
    comando1,
    <MAS_COMANDOS>
  ],
  </SI_TIENE_COMANDOS>
}
```

Reemplazar los placeholders:
- `<SI_TIENE_COMANDOS>` / `<SI_TIENE_TABS>` — incluir o excluir secciones según respuestas
- `<plugin_id>` — ID del plugin
- `<plugin_name>` — nombre legible
- `<tab_panel>` — sidebarRight / sidebarChat / devPanel
- `<tab_label>` — label del tab
- `<tab_priority>` — prioridad numérica
- `<MAS_COMANDOS>` — imports adicionales separados por coma

---

## 6. Generar comandos de chat (si aplica)

Para cada comando en `<comandos>`, crear `frontend/src/modules/<plugin_id>/commands/<nombre>.js`:

```javascript
import { parseCommandArgs } from '../../../composables/parseCommandArgs.js'
import { getUsedFlags } from '../../../composables/parseCommandArgs.js'

export default {
  name: '<comando_name>',
  category: '<comando_category>',
  description: '<comando_description>',
  usage: '<comando_name> <FLAGS_USAGE>',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    <FLAGS_AUTOCOMPLETE>
  },
  async execute(args, { chatStore, loadingIdx, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params, errors } = parseCommandArgs(args, {
      <FLAGS_SCHEMA>
    })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }

    // --- Lógica del comando ---
    // Ejemplo base:
    // const res = await fetch('/api/<plugin_id>/<endpoint>', { credentials: 'include' })
    // const data = await res.json()
    // return JSON.stringify(data, null, 2)

    return 'Comando ejecutado correctamente.'
  },
}
```

Reemplazar placeholders:
- `<comando_name>` — nombre completo del comando (ej: `/notif_listar`)
- `<comando_category>` — categoría
- `<comando_description>` — descripción
- `<FLAGS_USAGE>` — `--flag1=<valor> [--flag2=<valor>]` (opcionales entre corchetes)
- `<FLAGS_AUTOCOMPLETE>` — lógica de autocomplete para cada flag
- `<FLAGS_SCHEMA>` — schema de parseCommandArgs con cada flag

### Patrón de autocomplete para flags

```javascript
// Para N flags, generar:
if (!usedFlags.includes('--flag1')) {
  cmdStore.showAutocomplete(['--flag1='])
} else if (!usedFlags.includes('--flag2')) {
  cmdStore.showAutocomplete(['--flag2='])
} else {
  cmdStore.hideAutocomplete()
}
```

### Patrón de schema para flags

```javascript
flag1: { required: true },    // si es requerida
flag2: { required: false },   // si es opcional
```

---

## 7. Generar componente tab (si aplica)

Crear `frontend/src/modules/<plugin_id>/components/<plugin_id>Tab.vue`:

```vue
<template>
  <div class="p-2" style="height:100%;display:flex;flex-direction:column;">
    <h6 class="mb-2"><tab_label></h6>

    <!-- Contenido del tab -->
    <div class="flex-grow-1">
      <p class="text-muted small">Contenido de <plugin_name></p>
    </div>
  </div>
</template>

<script>
export default {
  name: '<plugin_id>Tab',
  data() {
    return {
      cargando: false,
    }
  },
  methods: {
    // --- Lógica del componente ---
  },
}
</script>
```

---

## 8. Generar vista para ruta independiente (si aplica)

Si `<tiene_ruta>` = `Si`:

### 8.1 Crear vista Vue

Crear `frontend/src/modules/<plugin_id>/components/<plugin_id>View.vue`:

```vue
<template>
  <div class="container py-4">
    <h1 class="mb-4"><plugin_name></h1>

    <div>
      <p class="text-muted">Contenido de <plugin_name></p>
    </div>
  </div>
</template>

<script>
export default {
  name: '<plugin_id>View',
  data() {
    return {
      cargando: false,
    }
  },
}
</script>
```

### 8.2 Agregar ruta en Vue Router

Modificar `frontend/src/router/index.js`:

Importar dinámicamente la vista:

```javascript
  {
    path: '<ruta_path>',
    name: '<ruta_name>',
    component: () => import('../modules/<plugin_id>/components/<plugin_id>View.vue'),
    meta: { requiereAuth: true<SI_TIENE_PERMISO>, permisos: ['<menu_permiso>']</SI_TIENE_PERMISO> },
  },
```

### 8.3 Agregar enlace en menú lateral (si aplica)

Si `<tiene_menu>` = `Si`, modificar `frontend/src/components/layout/Sidebar.vue`.

Buscar el array `navItems()` dentro del `computed` y agregar:

```javascript
    { to: '<ruta_path>', label: '<menu_label>', icon: '<menu_icono>', permiso: '<menu_permiso>' },
```

Si NO tiene ruta independiente pero sí tiene menú, usar el path base del plugin:

```javascript
    { to: '/<plugin_id>', label: '<menu_label>', icon: '<menu_icono>', permiso: '<menu_permiso>' },
```

---

## 9. Generar backend (si aplica)

### 9.1 Manifest backend

Crear `backend/src/modules/<plugin_id>/index.js`:

```javascript
import <plugin_id>Routes from './<plugin_id>.routes.js'

export default {
  id: '<plugin_id>',
  name: '<plugin_name>',
  routes: [
    { path: '/api/<plugin_id>', router: <plugin_id>Routes },
  ],
}
```

### 9.2 Rutas Express

Crear `backend/src/modules/<plugin_id>/<plugin_id>.routes.js`:

```javascript
import { Router } from 'express'

const router = Router()

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'No autorizado' })
    return false
  }
  return true
}

// --- Rutas del plugin ---
// Ejemplo:
// router.get('/list', async (req, res) => {
//   if (!authGuard(req, res)) return
//   try {
//     // Lógica
//     res.status(200).json({ status: true, data: [] })
//   } catch (err) {
//     console.log('Error en <plugin_id>:', err)
//     res.status(200).json({ status: false, error: 'Error interno' })
//   }
// })

export default router
```

### 9.3 Controlador (opcional, si se necesita)

Si el plugin tiene lógica compleja, crear `backend/src/modules/<plugin_id>/<plugin_id>.controller.js` con funciones separadas e importarlas en las rutas.

### 9.4 Migraciones (si tiene BD)

#### Si la tabla NO existe (`<tabla_existe>` = "No, crear tabla nueva")

Crear migración en `backend/src/modules/<plugin_id>/<timestamp>_create_<plugin_id>.js`:

```javascript
export function up(knex) {
  return knex.schema.createTable('<tabla_bd>', (table) => {
    table.increments('id').primary()
    // <CAMPOS_TABLA>
    // string:   table.string('<nombre>', 255).notNullable()
    // text:     table.text('<nombre>').notNullable()
    // integer:  table.integer('<nombre>').notNullable()
    // decimal:  table.decimal('<nombre>', 10, 2).notNullable()
    // boolean:  table.boolean('<nombre>').defaultTo(false).notNullable()
    // date:     table.date('<nombre>').notNullable()
    // datetime: table.datetime('<nombre>').notNullable()
    // </CAMPOS_TABLA>
    table.timestamps(true, true)
  })
}

export function down(knex) {
  return knex.schema.dropTableIfExists('<tabla_bd>')
}
```

Preguntar al usuario los campos de la tabla:

```
<question>
Pregunta: ¿Cuántos campos tendrá la tabla <tabla_bd>? (sin contar id, created_at, updated_at)
Header: Campos de tabla
</question>
```

Para cada campo, preguntar nombre, tipo y restricciones (igual que en `crear-crud`).

#### Si la tabla ya existe

Preguntar si necesita agregar campos nuevos:

```
<question>
Pregunta: ¿Necesitas agregar campos nuevos a la tabla existente <tabla_bd>?
Header: Alterar tabla
Options:
  - Si
  - No (Recommended)
</question>
```

Si `Si`, generar migración ALTER TABLE con `.nullable()` en todos los campos nuevos.

---

## 10. Generar documentación

### 10.1 Actualizar COMANDOS.md

Si el plugin tiene comandos, agregar una fila en `docs/COMANDOS.md` para cada comando en la categoría correspondiente (o crear nueva categoría si no existe).

Formato de tabla:
```markdown
| /comando | Descripción | `/comando --flag=<valor>` |
```

### 10.2 Actualizar ENDPOINTS.md

Si el plugin tiene backend, agregar los endpoints en `docs/ENDPOINTS.md`.

Formato:
```markdown
### /api/<plugin_id>/
| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | /api/<plugin_id>/list | Listar | Sí |
| POST | /api/<plugin_id>/create | Crear | Sí |
```

---

## 11. Actualizar DB_SCHEMA.md

Si el plugin tiene base de datos, agregar el esquema de la tabla en `docs/DB_SCHEMA.md`.

---

## 12. Reglas obligatorias

1. **ID único:** `plugin_id` debe ser único. Si otro módulo usa el mismo ID, lo reemplaza.
2. **No tocar archivos de orquestación:** No modificar `main.js`, `SidebarRight.vue`, `SidebarChat.vue`, `DevInstancePanel.vue`, `backend/src/index.js`. Excepciones: `Sidebar.vue` (menú) y `router/index.js` (ruta).
3. **Comandos en manifest:** Los comandos se exportan desde el manifest del módulo en `commands[]`. No usar side-effect `register()`.
4. **Dynamic imports para componentes:** Usar `() => import(...)` siempre, nunca import estático en el manifest.
5. **Prohibido TypeScript** en cualquier parte del proyecto.
6. **Prohibido `||` como fallback de parámetros:** Validar explícitamente cada argumento requerido y devolver error si falta.
7. **Manejo de errores:** Todo `catch` debe registrar el error con `console.log`. Prohibido `catch {}` vacío.
8. **Prohibido `alert()`:** Usar `modal.open(AlertModal, ...)` para notificaciones al usuario.
9. **Formato `--nombre=valor` obligatorio:** Todos los parámetros de comandos deben usar flags con `--`. Prohibido argumentos posicionales (excepciones: `/git` y `/skill_editar`).
10. **Usar `parseCommandArgs`** para parsear argumentos de comandos.
11. **Usar `getUsedFlags`** para autocomplete de comandos.
12. **Session-scoping obligatorio:** Si el tab depende de una sesión de chat activa, validar con `useChatStore().activeSessionId`.
13. **Sin stores dedicadas en el módulo:** Usar stores Pinia existentes o `ref()` locales. Si se necesita store nueva, crearla en `frontend/src/stores/`.

---

## 13. Verificación obligatoria

Ejecutar los siguientes pasos en orden y **confirmar cada resultado**:

| # | Comando / Acción | Resultado esperado |
|---|------------------|-------------------|
| 1 | `cd frontend && npm run build` | `✓ built in Xs` sin errores |
| 2 | `cd backend && npm run migrate:latest` (si hay migraciones) | Migración aplicada sin errores |
| 3 | `cd backend && npm run dev` (probar inicio) | Servidor inicia sin errores |
| 4 | `curl -s http://localhost:4000/api/<plugin_id>/list` (si hay backend) | `200` o `401` (requiere auth) |
| 5 | Navegar al tab en el panel correspondiente | Tab visible con el label correcto |
| 6 | Escribir `/help` en el chat (si hay comandos) | Comandos listados bajo categoría correcta |
| 7 | Escribir `/<comando> --flag=valor` (si hay comandos) | Comando ejecutado sin errores |
| 8 | Navegar a `<ruta_path>` (si hay ruta) | Vista se renderiza correctamente |
| 9 | Verificar menú lateral (si aplica) | Enlace visible con icono y label |
| 10 | Leer `docs/COMANDOS.md` (si hay comandos) | Comandos documentados |
| 11 | Leer `docs/ENDPOINTS.md` (si hay backend) | Endpoints documentados |
| 12 | Leer `docs/DB_SCHEMA.md` (si hay BD) | Esquema de tabla documentado |

---

## 14. Output

El agente debe generar/crear:

Archivos del plugin en:
- `frontend/src/modules/<plugin_id>/` (manifest + componentes + comandos)
- `backend/src/modules/<plugin_id>/` (manifest + rutas + controlador + migraciones)

Modificaciones controladas (solo si aplica):
- `frontend/src/components/layout/Sidebar.vue` — enlace en menú lateral
- `frontend/src/router/index.js` — ruta Vue Router
- `docs/COMANDOS.md` — documentación de comandos
- `docs/ENDPOINTS.md` — documentación de endpoints
- `docs/DB_SCHEMA.md` — documentación de esquema BD

No modificar ningún otro archivo fuera de los listados.
