# CRITERIOS PARA DEFINICIÓN DE COMANDOS

## 1. Sintaxis de parámetros

**Todo parámetro debe usar la forma `--nombre=valor`.** No se permiten argumentos posicionales sueltos, excepto en comandos _passthrough_ (ver §10).

### Reglas

| Forma | Ejemplo | Válido |
|---|---|---|
| `--nombre=valor` | `--id=42` | ✅ Obligatorio |
| `--nombre` (flag booleano) | `--import` | ✅ Equivale a `true` |
| `--nombre="valor con espacios"` | `--dir="/ruta/con espacios"` | ✅ Se permiten comillas |
| `<valor_suelto>` | `42` | ❌ Prohibido |
| `<ruta>` | `/home/user` | ❌ Prohibido |

### Separador

- Usar **`=`** entre el nombre y el valor
- No se permite el espacio como separador (`--nombre valor` está prohibido)

### Tipos de valor

- **string:** Valor textual. Ej: `--tipo=base_datos`
- **number:** Valor numérico. Ej: `--id=42`
- **boolean:** Presencia del flag sin `=valor` equivale a `true`. Ej: `--comments` es `true`. Para `false`, simplemente no incluir el flag.

## 2. Validación de parámetros

- **Todo parámetro requerido debe validarse explícitamente.**
- **Prohibido `||` como fallback de parámetros:** si un argumento es requerido, validarlo y devolver error si falta.
- **Prohibido `catch {}` vacío:** todo error debe registrarse con `console.error` (frontend) o `console.log` (backend).
- Los errores de validación deben ser descriptivos: indicar qué parámetro falta y el formato esperado.

### Ejemplo de validación

```js
// ✅ Correcto
const { id } = parseCommandArgs(args, { id: { required: true } })
if (errors.length > 0) throw new Error(errors.join('. '))

// ❌ Incorrecto
const id = args[0] || 42
```

## 3. Definición de comandos (useCommandRegistry)

Todo comando debe registrarse mediante `register()` con la siguiente estructura:

```js
register({
  name: '/comando',
  category: 'Categoría',
  description: 'Descripción clara de qué hace el comando.',
  usage: '/comando --param1=<tipo> [--param2=<tipo>]',
  autocomplete(args, cmdStore) { /* sugerir --param= o valores */ },
  async execute(args, { cmdStore, chatStore, loadingIdx }) {
    const { params, errors } = parseCommandArgs(args, {
      param1: { required: true },
      param2: { required: false },
    })
    if (errors.length > 0) throw new Error(errors.join('. '))
    // ... lógica del comando
  },
})
```

### Campos obligatorios

| Campo | Descripción |
|---|---|
| `name` | Nombre del comando con prefijo `/` |
| `category` | Categoría para agrupar en la ayuda |
| `description` | Descripción funcional |
| `usage` | Forma de uso mostrando todos los parámetros con `--nombre=<tipo>` |
| `execute` | Función asíncrona que recibe `(args, { cmdStore, chatStore, loadingIdx })` |

### Campo opcional

| Campo | Descripción |
|---|---|
| `autocomplete` | Función asíncrona que recibe `(args, cmdStore)` para sugerir opciones al presionar Tab |

## 4. Uso del helper `parseCommandArgs`

Todos los comandos que usen parámetros con `--nombre=valor` deben usar el helper compartido `parseCommandArgs(args, schema)` definido en `frontend/src/composables/parseCommandArgs.js`.

Los comandos _passthrough_ (ver §10) quedan exceptuados.

### Schema

El schema define los parámetros esperados:

```js
{
  paramName: {
    required: true,     // true = obligatorio, false = opcional
    type: 'string',     // 'string' | 'number' | 'boolean' (inferido de la presencia del flag)
  }
}
```

### Retorno

```js
const { params, errors } = parseCommandArgs(args, schema)
// params  = { nombre: 'valor', ... }
// errors  = ['Parámetro requerido: --id=<number>', ...]
```

## 5. Autocompletado (Tab)

### 5.1. Detectar flags ya en uso

La función `autocomplete()` debe determinar **qué `--variable=` ya está presente** en `args` y **excluirla** de las sugerencias. Esto evita que el usuario intente agregar un flag duplicado.

### 5.2. Esquema general

```js
const ALL_FLAGS = ['--dir=', '--gitignore=', '--filter-extension=']

autocomplete(args, cmdStore) {
  const usedFlags = args
    .filter(a => a.startsWith('--'))
    .map(a => a.split('=')[0] + '=')       // '--dir=' , '--gitignore=' ...
  const suggestions = ALL_FLAGS.filter(f => !usedFlags.includes(f))

  if (suggestions.length > 0) {
    cmdStore.showAutocomplete(suggestions)
  } else {
    cmdStore.hideAutocomplete()
  }
}
```

### 5.3. Flags con valores precargables

Cuando un flag acepta un conjunto conocido de valores (ej: `--navegador=chrome|firefox`, `--mode=0|1`, IDs de proyecto), el autocompletado debe:

1. Si el flag **no tiene valor** parcial (`args.find(a => a === '--flag=')` o el flag no está presente), sugerir el flag vacío: `['--flag=']`
2. Si el flag **tiene valor** parcial (`--flag=chr`), filtrar los valores candidatos que coincidan
3. Si el flag **ya tiene valor completo** (`--flag=chrome`), **no sugerir nada** para ese flag

```js
const navegadorArg = args.find(a => a.startsWith('--navegador='))
if (navegadorArg) {
  const val = navegadorArg.slice('--navegador='.length)
  if (!val) {
    // flag sin valor: sugerir opciones
    cmdStore.showAutocomplete([
      { display: 'chrome', value: '--navegador=chrome' },
      { display: 'firefox', value: '--navegador=firefox' },
    ])
    return
  }
  // flag con valor parcial: filtrar coincidencias
  const filtered = ['chrome', 'firefox'].filter(b => b.includes(val))
  cmdStore.showAutocomplete(filtered.map(b => ({ display: b, value: `--navegador=${b}` })))
  return
}
```

### 5.4. Orden de sugerencias

1. Primero sugerir los flags que aún no están en uso (`--variable=`)
2. Si el usuario ya escribió un flag con valor parcial, sugerir valores coincidentes
3. Si todos los flags están completos, ocultar el autocompletado

## 6. Documentación

- `docs/COMANDOS.md` debe reflejar el `usage` exacto de cada comando
- Los parámetros opcionales van entre `[corchetes]`, los obligatorios entre `<angulares>`
- Ejemplo: `/comando --param1=<obligatorio> [--param2=<opcional>]`

## 7. Prohibiciones explícitas

| Práctica | Motivo |
|---|---|
| `args[0]` o `args.join(' ')` sin parsear | Argumento suelto, viola el formato `--variable=valor` |
| `catch {}` vacío | Oculta errores, prohibido registrar en consola |
| `catch { /* silencio */ }` | Misma razón |
| `||` como fallback de parámetros | Asigna valor por defecto silenciosamente |
| Parámetros posicionales sin flag | Inconsistentes y difíciles de recordar |

## 8. Comandos que referencian directamente a Redmine

Todo comando que realice operaciones directas contra la API de Redmine (test de conexión, listar proyectos, obtener/importar tickets) **debe comenzar con `/redmine_`**.

### Estructura

```
/redmine_[verbo]_[sustantivo]
```

| Parte | Descripción | Ejemplos |
|---|---|---|
| `verbo` | Acción a realizar | `test`, `listar`, `importar` |
| `sustantivo` | Entidad de Redmine | `conexion`, `proyectos`, `tickets` |

### Ejemplos

| Nombre | Verbo | Sustantivo | Significado |
|---|---|---|---|
| `/redmine_test_conexion` | `test` | `conexion` | Probar conexión a Redmine |
| `/redmine_listar_proyectos` | `listar` | `proyectos` | Listar proyectos de Redmine |
| `/redmine_listar_tickets` | `listar` | `tickets` | Listar tickets de un proyecto Redmine |
| `/redmine_importar_tickets` | `importar` | `tickets` | Importar tickets de Redmine a DB local |

### Excepciones

Los comandos de sesión de chat que operan sobre tickets de Redmine **quedan excluidos** de esta regla, ya que pertenecen a la convención `/chat_[verbo]_[objeto]`:

- `/chat_set_ticket` — asigna ticket a la sesión (comando de sesión, no de Redmine directo)
- `/chat_get_ticket` — muestra ticket de la sesión (comando de sesión)
- `/chat_edit_ticket` — edita ticket de la sesión (comando de sesión)

## 9. Comandos del navegador (Playwright)

Todo comando que controle directamente el navegador web (iniciar, navegar, configurar, finalizar) **debe comenzar con `/navegador_`**.

### Estructura

```
/navegador_[verbo]_[sustantivo]
```

| Parte | Descripción | Ejemplos |
|---|---|---|
| `verbo` | Acción a realizar | `iniciar`, `ir`, `configurar`, `finalizar` |
| `sustantivo` | Entidad del navegador | `url`, `headless` |

### Ejemplos

| Nombre | Verbo | Sustantivo | Significado |
|---|---|---|---|
| `/navegador_iniciar` | `iniciar` | *(implícito)* | Iniciar sesión de navegador |
| `/navegador_ir_url` | `ir` | `url` | Navegar a una URL |
| `/navegador_configurar_headless` | `configurar` | `headless` | Cambiar modo headless |
| `/navegador_finalizar` | `finalizar` | *(implícito)* | Finalizar sesión de navegador |

### Excepciones

Los comandos de resolución de pantalla **quedan excluidos** por ser una categoría independiente:

- `/resoluciones_get_all` — muestra resoluciones configuradas
- `/resolucion_get_default` — muestra resolución por defecto
- `/resolucion_set_default` — establece resolución por defecto con autocompletado

## 10. Comandos de despliegue

Todo comando que gestione la configuración e instancias de desarrollo **debe comenzar con `/despliegue_`**.

### Estructura

```
/despliegue_[verbo]_[sustantivo]
```

### Ejemplos

| Nombre | Verbo | Sustantivo | Significado |
|---|---|---|---|
| `/despliegue_actualizar_config` | `actualizar` | `config` | Cargar configuración desde deploy.json |
| `/despliegue_mostrar_config` | `mostrar` | `config` | Mostrar configuración guardada |
| `/despliegue_iniciar_instancia` | `iniciar` | `instancia` | Iniciar procesos de desarrollo |
| `/despliegue_detener_instancia` | `detener` | `instancia` | Detener procesos de desarrollo |
| `/despliegue_ver_estado` | `ver` | `estado` | Ver estado de procesos |

### Comportamiento ante falta de configuración

Si `/despliegue_iniciar_instancia` no encuentra configuración guardada, **no debe fallar**. Debe ejecutar automáticamente `/despliegue_actualizar_config` (leer `deploy.json` del proyecto y guardar la configuración) y luego continuar con el inicio de la instancia.

### Gestión de estado centralizado (Pinia)

Todos los comandos de gestión de instancias (`/despliegue_iniciar_instancia`, `/despliegue_detener_instancia`, `/despliegue_ver_estado`) deben centralizar el estado de la instancia de desarrollo en un store de Pinia.

Los componentes que dependan del estado de la instancia (Playwright, indicadores de procesos, estado del navegador, etc.) deben consumir ese mismo store, de modo que los cambios se reflejen reactivamente en todos los componentes sin lógica de actualización dispersa ni recargas manuales.

## 11. Comandos de desarrollo (OpenCode y utilidades dev)

Todo comando que forme parte del ecosistema de desarrollo (funcionalidades, documentación, OpenCode, git) **debe comenzar con `/dev_`**.

### Estructura

```
/dev_[cosa]_[verbo]_[sustantivo]
```

| Parte | Descripción | Ejemplos |
|---|---|---|
| `cosa` | Subcategoría | `funcionalidad`, `documento`, `opencode`, `git` |
| `verbo` | Acción | `crear`, `listar`, `actualizar`, `iniciar`, `finalizar`, `generar` |
| `sustantivo` | Opcional, entidad | `commit`, `rama` |

### Ejemplos

| Nombre | Cosa | Verbo | Sustantivo | Significado |
|---|---|---|---|---|
| `/dev_funcionalidad_crear` | funcionalidad | crear | — | Wizard nueva funcionalidad |
| `/dev_funcionalidad_listar` | funcionalidad | listar | — | Listar funcionalidades |
| `/dev_documento_listar` | documento | listar | — | Obtener documentación del proyecto |
| `/dev_documento_actualizar` | documento | actualizar | — | Actualizar documentación con OpenCode |
| `/dev_opencode_iniciar` | opencode | iniciar | — | Iniciar sesión OpenCode |
| `/dev_opencode_finalizar` | opencode | finalizar | — | Finalizar sesión OpenCode |
| `/dev_opencode_generar_commit` | opencode | generar | commit | Generar mensaje de commit |
| `/dev_git_crear_rama` | git | crear | rama | Crear rama desde proyecto y ticket |

## 12. Comandos de gastos

Todo comando que consulte registros de gastos de tokens **debe comenzar con `/gastos_`**.

### Estructura

```
/gastos_[verbo]_[sustantivo]
```

### Ejemplos

| Nombre | Verbo | Sustantivo | Significado |
|---|---|---|---|
| `/gastos_listar` | listar | — | Mostrar todos los gastos |
| `/gastos_listar_proyecto` | listar | proyecto | Mostrar gastos de un proyecto |

## 12b. Comandos de ambientes

Todo comando que liste o gestione ambientes de trabajo (DEV, TST, PRD, etc.) **debe comenzar con `/ambientes_`**.

### Estructura

```
/ambientes_[verbo]
```

| Parte | Descripción | Ejemplos |
|---|---|---|
| `verbo` | Acción a realizar | `listar` |

### Ejemplos

| Nombre | Verbo | Significado |
|---|---|---|
| `/ambientes_listar` | `listar` | Listar ambientes configurados |
| `/ambientes_merge` | `merge` | Hacer merge a la rama de un ambiente |

---

## 13. Comandos ligados a la sesión de chat

Todo comando que opere sobre datos o contexto de la sesión de chat activa (sesiones, tickets, proyectos, etc.) **debe comenzar con `/chat_`**.

### Estructura

```
/chat_[verbo]_[objeto]
```

| Parte | Descripción | Ejemplos |
|---|---|---|
| `verbo` | Acción a realizar | `set`, `get`, `edit`, `create`, `delete` |
| `objeto` | Entidad sobre la que se actúa | `proyecto`, `ticket`, `repositorio` |

### Ejemplos

| Nombre | Verbo | Objeto | Significado |
|---|---|---|---|
| `/chat_set_proyecto` | `set` | `proyecto` | Asignar proyecto a la sesión |
| `/chat_get_ticket` | `get` | `ticket` | Mostrar ticket de la sesión |
| `/chat_edit_ticket` | `edit` | `ticket` | Editar ticket de la sesión |
| `/chat_set_repositorio` | `set` | `repositorio` | Asignar repositorio al proyecto de la sesión |

### Excepciones

- Los comandos de navegación (`/cd`, `/ls`) no están ligados a la sesión de chat, solo al directorio de trabajo
- Los comandos de sistema (`/help`, `/history`) son globales
- Los comandos passthrough (`/git`) son puertas a herramientas externas

## 14. Excepción: comandos passthrough

Algunos comandos actúan como **puerta de enlace** a herramientas externas con sintaxis propia (ej: `/git`). Estos comandos **no pueden** encapsular su sintaxis en `--nombre=valor` porque los argumentos son impredecibles y pueden incluir subcomandos, flags propios, etc.

### Reglas para passthrough

1. **Deben estar documentados explícitamente** como excepción en `docs/COMANDOS.md`
2. **No pueden usar `parseCommandArgs`** — operan directamente con `args.join(' ')`
3. **Deben tener `usage` con `<comando>`** (formato tradicional) en vez de `--param=`
4. **No deben expandirse** — si se necesita una nueva función, crear un comando específico (ej: `/git_log` en vez de extender `/git`)
5. **El número de comandos passthrough debe ser mínimo** — idealmente 1 o 2 en todo el sistema

---

## 15. Actualización de componentes al cambiar de rama

Todo comando que implique un cambio de rama Git (crear, checkout, merge, etc.) **debe actualizar todos los componentes visuales** que muestren o consuman la rama actual.

### Comandos afectados

| Comando | Acción |
|---|---|
| `/dev_git_crear_rama` | Crea y cambia a una nueva rama |
| `/dev_git_ir_rama_ticket` | Hace checkout a la rama del ticket |
| `/ambientes_merge` | Hace merge a la rama destino (el checkout implícito debe reflejarse) |

### Reglas

1. **Después de ejecutar** cualquier comando que cambie la rama activa, los componentes que muestren la rama (ej: Topbar, indicadores de estado) deben reflejar el nuevo valor.
2. **Mecanismo:** usar el store o evento correspondiente para actualizar el estado, no recargar la página.
3. **Validación:** antes del cambio de rama validar que no haya cambios sin comitear. Si los hay, informar al usuario y abortar (salvo que el comando documente explícitamente otro comportamiento).
4. **Comandos passthrough `/git`:** al ser una puerta genérica a Git, no pueden actualizar componentes automáticamente. Después de ejecutar un `/git checkout`, `/git branch`, `/git merge`, etc., se debe refrescar la rama actual consultando el directorio de trabajo.
