# COMANDOS — Chat del asistente

Todos los comandos se escriben con prefijo `/` en el input del chat.

**Todos los parámetros deben usar el formato `--nombre=valor`.** No se permiten argumentos posicionales sueltos. Los flags booleanos se usan sin valor (ej: `--comments`, `--import`).

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
| `/cd` | Cambia el directorio de trabajo de la sesión. Soporta rutas absolutas, relativas, `.`, `..`, `~` y autocompletado con Tab | `/cd --dir=<ruta>` |
| `/ls` | Lista el contenido del directorio actual o del especificado | `/ls [--dir=<ruta>]` |
| `/arbol_directorios` | Muestra el árbol de directorios en formato JSON respetando `.gitignore`. Usar `--gitignore=false` para mostrar todo el listado completo. Usar `--filter-extension="sql,md,js"` para mostrar solo directorios que contengan archivos con esas extensiones | `/arbol_directorios [--dir=<ruta>] [--gitignore=<bool>] [--filter-extension=<ext1,ext2>]` |

---

## Utilidades

| Comando | Descripción | Uso |
|---|---|---|
| `/redmine_test_conexion` | Prueba la conexión a la instancia de Redmine configurada | `/redmine_test_conexion` |
| `/redmine_listar_proyectos` | Lista proyectos Redmine. Con `--import` importa todos a la base de datos local | `/redmine_listar_proyectos [--import]` |
| `/redmine_listar_tickets` | Obtiene la lista de tickets de Redmine para un proyecto importado. Usa Tab para autocompletar con los proyectos disponibles | `/redmine_listar_tickets --id=<id_proyecto>` |
| `/redmine_importar_tickets` | Importa todos los tickets de Redmine de un proyecto o de todos los proyectos a la base de datos local. Usa Tab para autocompletar | `/redmine_importar_tickets [--id=<id_proyecto> \| --all]` |
| `/redmine_crear_ticket` | Abre un formulario inline para crear un nuevo ticket en Redmine: seleccionar proyecto, asunto, descripción, estado, prioridad, asignado y % de avance | `/redmine_crear_ticket` |

---

## Navegador (Playwright)

| Comando | Descripción | Uso |
|---|---|---|
| `/navegador_iniciar` | Abre un navegador (chrome/firefox). Usa Tab para autocompletar cada flag | `/navegador_iniciar [--navegador=chrome\|firefox] [--resolution=ID] [--url=URL]` |
| `/navegador_ir_url` | Navega a una URL en la sesión de navegador activa | `/navegador_ir_url --url=<url>` |
| `/navegador_configurar_headless` | Cambia el modo headless (0 = visible, 1 = headless). Si hay sesión activa, la reinicia | `/navegador_configurar_headless --mode=<0\|1>` |
| `/navegador_finalizar` | Finaliza la sesión de navegador activa | `/navegador_finalizar` |
| `/resoluciones_get_all` | Muestra las resoluciones de pantalla configuradas con selector interactivo para establecer una por defecto | `/resoluciones_get_all` |
| `/resolucion_default` | Muestra la resolución de pantalla por defecto configurada | `/resolucion_default` |

---

## Proyecto

| Comando | Descripción | Uso |
|---|---|---|
| `/chat_set_proyecto` | Asigna un proyecto a la sesión actual. Sin argumentos abre modal para crear uno nuevo | `/chat_set_proyecto [--id=<id_proyecto>]` |
| `/chat_get_proyecto` | Muestra el ID del proyecto asignado a la sesión actual | `/chat_get_proyecto` |
| `/chat_set_repositorio` | Asigna una URL de repositorio GitHub al proyecto actual. Usa Tab para autocompletar `--url=` | `/chat_set_repositorio --url=<url>` |
| `/chat_get_repositorio_url` | Muestra la URL del repositorio configurada para el proyecto actual | `/chat_get_repositorio_url` |
| `/chat_set_ticket` | Asigna un ticket de Redmine a la sesión actual. Autocompletado filtrado por el proyecto de la sesión | `/chat_set_ticket --id=<id_ticket_redmine>` |
| `/chat_get_ticket` | Muestra el ticket de Redmine asignado a la sesión actual, incluyendo su descripción. Con `--comments` muestra también los comentarios. Los adjuntos se listan al final: las imágenes se muestran inline y los archivos se pueden descargar mediante enlace | `/chat_get_ticket [--comments]` |
| `/chat_edit_ticket` | Abre un editor inline para modificar los datos del ticket de Redmine asignado a la sesión actual (asunto, descripción, estado, prioridad, asignado, + nuevo comentario). Con `--mode=descripcion` abre un asistente con OpenCode para redactar una descripción del ticket usando IA. | `/chat_edit_ticket [--mode=descripcion]` |
| `/proyecto_var_listar` | Lista las variables definidas para un proyecto. Sin `--id` usa el proyecto de la sesión actual | `/proyecto_var_listar [--id=proyecto]` |
| `/proyecto_var_crear` | Crea una nueva variable en un proyecto. Sin `--id` usa el proyecto de la sesión actual | `/proyecto_var_crear --key=nombre --value=valor [--id=proyecto]` |
| `/proyecto_var_actualizar` | Actualiza el valor de una variable existente en un proyecto. Sin `--id` usa el proyecto de la sesión actual | `/proyecto_var_actualizar --key=nombre --value=valor [--id=proyecto]` |
| `/proyecto_var_eliminar` | Elimina una variable de un proyecto. Sin `--id` usa el proyecto de la sesión actual | `/proyecto_var_eliminar --key=nombre [--id=proyecto]` |

### Interpolación de variables

Las variables de proyecto pueden usarse en cualquier campo de texto del chat (mensajes, prompts de OpenCode, etc.) mediante la sintaxis `{{nombre_variable}}`. Al enviar el texto, el sistema resuelve automáticamente las variables reemplazando `{{nombre}}` por su valor, siempre que la sesión tenga un proyecto asignado.

---

## Gastos

| Comando | Descripción | Uso |
|---|---|---|
| `/gastos_listar` | Muestra todos los registros de gastos de tokens | `/gastos_listar` |
| `/gastos_listar_proyecto` | Muestra gastos del proyecto activo o del especificado | `/gastos_listar_proyecto [--id=<id_proyecto>]` |

---

## Desarrollo

| Comando | Descripción | Uso |
|---|---|---|
| `/dev_funcionalidad_crear` | Inicia el wizard para relevar y desarrollar una nueva funcionalidad. Requiere un proyecto asignado con `/chat_set_proyecto` | `/dev_funcionalidad_crear` |
| `/dev_funcionalidad_listar` | Lista funcionalidades del proyecto de la sesión o del especificado | `/dev_funcionalidad_listar [--id=<id_proyecto>]` |
| `/dev_documento_listar` | Obtiene toda la documentación de un proyecto. Si no se especifica, usa el de la sesión actual | `/dev_documento_listar [--id=<id_proyecto>]` |
| `/dev_documento_actualizar` | Actualiza la documentación del proyecto usando OpenCode para el tipo indicado | `/dev_documento_actualizar --tipo=<tipo>` |
| `/dev_opencode_iniciar` | Inicia una sesión OpenCode: seleccionar proveedor, modelo, modo y enviar prompt. Después de cada respuesta se puede seguir enviando mensajes. | `/dev_opencode_iniciar` |
| `/dev_opencode_generar_commit` | Genera un mensaje de commit de los cambios realizados usando OpenCode. Seleccioná proveedor, modelo, modo y modalidad de envío (encolar/enviar) para obtener una propuesta de commit. | `/dev_opencode_generar_commit` |
| `/dev_opencode_finalizar` | Finaliza la sesión OpenCode activa | `/dev_opencode_finalizar` |
| `/dev_git_crear_rama` | Crea una rama Git a partir del proyecto y ticket de la sesión | `/dev_git_crear_rama` |
| `/dev_git_ir_rama_ticket` | Cambia a la rama Git asociada al ticket de la sesión actual. Valida que no haya cambios sin comitear, que la sesión tenga ticket asignado y que la rama exista | `/dev_git_ir_rama_ticket` |
| `/dev_redmine_comentarios_listar` | Lista todos los comentarios de Redmine pendientes de envío | `/dev_redmine_comentarios_listar` |
| `/dev_redmine_comentarios_enviar` | Agrupa los comentarios pendientes, muestra vista previa editable y permite enviarlos a Redmine | `/dev_redmine_comentarios_enviar` |

---

## Git

| Comando | Descripción | Uso |
|---|---|---|
| `/git` | Ejecuta un comando de Git en el directorio de la sesión activa | `/git <comando>` |

---

## Plantillas

| Comando | Descripción | Uso |
|---|---|---|
| `/plantilla_crear` | Abre el editor modal para crear una nueva plantilla Markdown | `/plantilla_crear` |
| `/plantilla_listar` | Lista todas las plantillas disponibles con su slug, fecha de actualización e indicador 🔒 si es protegida del sistema | `/plantilla_listar` |
| `/plantilla_ver` | Muestra el contenido completo de una plantilla renderizado en el chat | `/plantilla_ver --slug=<slug>` |
| `/plantilla_editar` | Abre el editor modal con los datos de una plantilla existente para modificarlos. Las plantillas protegidas (🔒) no pueden editarse | `/plantilla_editar --slug=<slug>` |
| `/plantilla_eliminar` | Elimina una plantilla de forma permanente. Las plantillas protegidas (🔒) no pueden eliminarse | `/plantilla_eliminar --slug=<slug>` |

---

## Despliegue

| Comando | Descripción | Uso |
|---|---|---|
| `/despliegue_actualizar_config` | Lee `deploy.json` del directorio del proyecto y guarda la configuración de despliegue en la base de datos | `/despliegue_actualizar_config` |
| `/despliegue_mostrar_config` | Muestra la configuración de despliegue guardada para el proyecto actual como JSON formateado | `/despliegue_mostrar_config` |
| `/despliegue_iniciar_instancia` | Lee la configuración de despliegue, ejecuta `npm ci` en paralelo en cada subproyecto e inicia los procesos de desarrollo | `/despliegue_iniciar_instancia [--resolucion=ID]` |
| `/despliegue_detener_instancia` | Detiene todos los procesos de desarrollo iniciados con `/despliegue_iniciar_instancia` | `/despliegue_detener_instancia` |
| `/despliegue_ver_estado` | Muestra el estado (running/stopped/error) de cada proceso de desarrollo | `/despliegue_ver_estado` |

---

---

## Ambientes

| Comando | Descripción | Uso |
|---|---|---|
| `/ambientes_listar` | Lista los ambientes configurados (DEV, TST, PRD, etc.) con su rama y descripción | `/ambientes_listar` |
| `/ambientes_merge` | Hace merge de la rama actual a la rama del ambiente destino, hace push y opcionalmente notifica a Redmine. Requiere que no haya cambios pendientes. Si hay conflictos, el usuario debe resolverlos manualmente | `/ambientes_merge --ambiente=<nombre> [--mensaje=<texto>] [--comentar=<enviar|encolar>]` |

---

## Notas

- Los comandos se definen mediante `register({ name, category, description, usage, execute })` desde `useCommandRegistry.js`
- **Todos los parámetros deben usar el formato `--nombre=valor`** (ver `docs/CRITERIOS_COMANDOS.md`). Excepción: `/git` usa argumentos posicionales por ser un comando _passthrough_ hacia una herramienta externa con sintaxis propia.
- El archivo `frontend/src/components/Topbar.vue` contiene registros inline
- Cada comando recibe `(args, { cmdStore, chatStore })` en su `execute()`
- Para parsear argumentos usar `parseCommandArgs(args, schema)` desde `frontend/src/composables/parseCommandArgs.js`
