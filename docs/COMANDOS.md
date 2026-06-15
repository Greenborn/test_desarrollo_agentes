# COMANDOS — Chat del asistente

Todos los comandos se escriben con prefijo `/` en el input del chat.
Los comandos registrados en frontend tienen prioridad sobre los del backend.

---

## Sistema

| Comando | Descripción | Uso |
|---|---|---|
| `/help` | Muestra la ayuda general de comandos organizada por categoría | `/help` |
| `/history` | Muestra el historial de comandos ejecutados | `/history` |

---

## Navegación

| Comando | Descripción | Uso |
|---|---|---|
| `/cd` | Cambia el directorio de trabajo de la sesión. Soporta rutas absolutas, relativas, `.`, `..`, `~` y autocompletado con Tab | `/cd <ruta>` |
| `/ls` | Lista el contenido del directorio actual o del especificado | `/ls [ruta]` |

---

## OpenCode

| Comando | Descripción | Uso |
|---|---|---|
| `/opencode` | Inicia una sesión OpenCode: seleccionar proveedor, modelo, modo y enviar prompt | `/opencode` |
| `/oc` | Envía un prompt a la sesión OpenCode activa. Si no hay sesión, inicia una nueva | `/oc <prompt>` |
| `/opencode_fin` | Finaliza la sesión OpenCode activa | `/opencode_fin` |

---

## Navegador (Playwright)

| Comando | Descripción | Uso |
|---|---|---|
| `/iniciar_navegador` | Abre un navegador (chrome/firefox) opcionalmente en una URL | `/iniciar_navegador [chrome\|firefox] [url]` |
| `/navegador_go_to` | Navega a una URL en la sesión de navegador activa | `/navegador_go_to <url>` |
| `/navegador_set_headless` | Cambia el modo headless (0 = visible, 1 = headless). Si hay sesión activa, la reinicia | `/navegador_set_headless <0\|1>` |
| `/navegador_fin` | Finaliza la sesión de navegador activa | `/navegador_fin` |

---

## Proyecto

| Comando | Descripción | Uso |
|---|---|---|
| `/proyecto_set` | Asigna un proyecto a la sesión actual. Sin argumentos abre modal para crear uno nuevo | `/proyecto_set [id_proyecto]` |
| `/proyecto_info` | Muestra el ID del proyecto asignado a la sesión actual | `/proyecto_info` |

---

## Gastos

| Comando | Descripción | Uso |
|---|---|---|
| `/gastos_all` | Muestra todos los registros de gastos de tokens | `/gastos_all` |
| `/gastos_proyecto` | Muestra gastos del proyecto activo o del especificado | `/gastos_proyecto [id_proyecto]` |

---

## Desarrollo

| Comando | Descripción | Uso |
|---|---|---|
| `/nueva_funcionalidad` | Inicia el wizard para relevar y desarrollar una nueva funcionalidad. Requiere un proyecto asignado con `/proyecto_set` | `/nueva_funcionalidad` |

---

## Notas

- Los comandos se definen mediante `register({ name, category, description, usage, execute })` desde `useCommandRegistry.js`
- El archivo `frontend/src/components/Topbar.vue` contiene la mayoría de los registros
- Cada comando recibe `(args, { cmdStore, chatStore })` en su `execute()`
