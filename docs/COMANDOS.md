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
| `/opencode` | Inicia una sesión OpenCode: seleccionar proveedor, modelo, modo y enviar prompt. Después de cada respuesta se puede seguir enviando mensajes. | `/opencode` |
| `/generar_commit` | Genera un mensaje de commit de los cambios realizados usando OpenCode. Seleccioná proveedor, modelo y modo para obtener una propuesta de commit en modo planificación. | `/generar_commit` |
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
| `/proyecto_set_repositorio` | Asigna una URL de repositorio GitHub al proyecto actual. Usa Tab para autocompletar `--url=` | `/proyecto_set_repositorio --url=<url>` |
| `/proyecto_get_url_repo` | Muestra la URL del repositorio configurada para el proyecto actual | `/proyecto_get_url_repo` |
| `/chat_set_ticket` | Asigna un ticket de Redmine a la sesión actual. Autocompletado filtrado por el proyecto de la sesión | `/chat_set_ticket <id_ticket_redmine>` |
| `/chat_get_ticket` | Muestra el ticket de Redmine asignado a la sesión actual, incluyendo su descripción. Con `--comments=true` muestra también los comentarios del ticket. Los adjuntos se listan al final: las imágenes se muestran inline y los archivos se pueden descargar mediante enlace | `/chat_get_ticket [--comments=true]` |
| `/chat_ticket_edit` | Abre un editor inline para modificar los datos del ticket de Redmine asignado a la sesión actual (asunto, descripción, estado, prioridad, asignado, + nuevo comentario). Con el argumento `descripcion` abre un asistente con OpenCode para redactar una descripción del ticket usando IA. | `/chat_ticket_edit [descripcion]` |

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

## Git

| Comando | Descripción | Uso |
|---|---|---|
| `/git` | Ejecuta un comando de Git en el directorio de la sesión activa | `/git <comando>` |

---

## Espacios de Trabajo (Workspaces)

La gestión de espacios de trabajo se realiza desde el modal de Configuración:
- El selector de workspace se encuentra debajo del buscador
- Los workspaces agrupan settings, sesiones de chat, proyectos y tickets
- El workspace "Por Defecto" (id=1) no se puede eliminar
- Al crear un workspace nuevo se copian las settings del default
- Al cambiar de workspace se detienen procesos activos (OpenCode, navegador)

## Despliegue

| Comando | Descripción | Uso |
|---|---|---|
| `/despliegue_upd_config` | Lee `deploy.json` del directorio del proyecto y guarda la configuración de despliegue en la base de datos. Requiere proyecto asignado con `/proyecto_set` | `/despliegue_upd_config` |
| `/despliegue_show_config` | Muestra la configuración de despliegue guardada para el proyecto actual como JSON formateado. Requiere proyecto asignado con `/proyecto_set` | `/despliegue_show_config` |
| `/iniciar_instancia_dev` | Lee la configuración de despliegue, ejecuta `npm ci` en paralelo en cada subproyecto e inicia los procesos de desarrollo: `nodemon` para backends (entradas en `pm2[]`), `npm run dev` para fronts (entradas en `build[]`). Requiere proyecto asignado y configuración de despliegue cargada | `/iniciar_instancia_dev` |
| `/instancia_dev_detener` | Detiene todos los procesos de desarrollo iniciados con `/iniciar_instancia_dev` | `/instancia_dev_detener` |
| `/instancia_dev_estado` | Muestra el estado (running/stopped/error) de cada proceso de desarrollo | `/instancia_dev_estado` |

---

## Notas

- Los comandos se definen mediante `register({ name, category, description, usage, execute })` desde `useCommandRegistry.js`
- El archivo `frontend/src/components/Topbar.vue` contiene la mayoría de los registros
- Cada comando recibe `(args, { cmdStore, chatStore })` en su `execute()`
