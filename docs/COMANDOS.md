# COMANDOS — Chat del asistente

Todos los comandos se escriben con prefijo `/` en el input del chat.
Los comandos registrados en frontend tienen prioridad sobre los del backend.

Si el texto ingresado **no** comienza con `/`, actúa como **omnifiltro**: filtra en vivo (con debounce configurable) las pestañas de chats y los proyectos del sidebar por los campos tooltip e ID respectivamente.

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
| `/arbol_directorios` | Muestra el árbol de directorios en formato JSON respetando `.gitignore`. Usar `--gitignore=false` para mostrar todo el listado completo. Usar `--filter-extension="sql,md,js"` para mostrar solo directorios que contengan archivos con esas extensiones | `/arbol_directorios [ruta] [--gitignore=false] [--filter-extension="ext1,ext2"]` |

---

## OpenCode

| Comando | Descripción | Uso |
|---|---|---|
| `/opencode` | Inicia una sesión OpenCode: seleccionar proveedor, modelo, modo y enviar prompt | `/opencode` |
| `/oc` | Envía un prompt a la sesión OpenCode activa. Si no hay sesión, inicia una nueva | `/oc <prompt>` |
| `/opencode_fin` | Finaliza la sesión OpenCode activa | `/opencode_fin` |

---

## Utilidades

| Comando | Descripción | Uso |
|---|---|---|
| `/redmine_test` | Prueba la conexión a la instancia de Redmine configurada | `/redmine_test` |
| `/redmine_proyectos` | Lista proyectos Redmine. Con `import_all` importa todos a la base de datos local | `/redmine_proyectos [import_all]` |
| `/redmine_tickets` | Obtiene la lista de tickets de Redmine para un proyecto importado. Usa Tab para autocompletar con los proyectos disponibles | `/redmine_tickets <id_proyecto>` |
| `/redmine_importar_tickets` | Importa todos los tickets de Redmine de un proyecto o de todos los proyectos a la base de datos local. Usa Tab para autocompletar | `/redmine_importar_tickets [id_proyecto\|--all]` |

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
