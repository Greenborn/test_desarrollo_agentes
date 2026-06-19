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

## 8. Comandos ligados a la sesión de chat

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

## 9. Excepción: comandos passthrough

Algunos comandos actúan como **puerta de enlace** a herramientas externas con sintaxis propia (ej: `/git`). Estos comandos **no pueden** encapsular su sintaxis en `--nombre=valor` porque los argumentos son impredecibles y pueden incluir subcomandos, flags propios, etc.

### Reglas para passthrough

1. **Deben estar documentados explícitamente** como excepción en `docs/COMANDOS.md`
2. **No pueden usar `parseCommandArgs`** — operan directamente con `args.join(' ')`
3. **Deben tener `usage` con `<comando>`** (formato tradicional) en vez de `--param=`
4. **No deben expandirse** — si se necesita una nueva función, crear un comando específico (ej: `/git_log` en vez de extender `/git`)
5. **El número de comandos passthrough debe ser mínimo** — idealmente 1 o 2 en todo el sistema
