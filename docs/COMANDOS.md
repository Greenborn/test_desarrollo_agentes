# COMANDOS — Chat del asistente

Todos los comandos se escriben con prefijo `/` en el input del chat.

**Todos los parámetros deben usar el formato `--nombre=valor`.** No se permiten argumentos posicionales sueltos. Los flags booleanos se usan sin valor (ej: `--comments`, `--import`).

Los comandos registrados en frontend tienen prioridad sobre los del backend.

- **Los resultados de cada comando se muestran siempre en la sesión de chat que lo inició**, independientemente de la sesión actualmente seleccionada. Ver `docs/CRITERIOS_COMANDOS.md §16`.

Si el texto ingresado **no** comienza con `/`, actúa como **omnifiltro**: filtra en vivo (con debounce configurable) las pestañas de chats y los proyectos del sidebar por los campos tooltip e ID respectivamente.

**Autocompletado con Tab:** Todos los comandos con parámetros soportan autocompletado vía Tab. Al presionar Tab se sugieren los `--flag=` disponibles. Si el flag acepta valores conocidos (IDs, nombres, modos), se filtran según lo que el usuario haya escrito.

---

## Sistema

| Comando | Descripción | Uso |
|---|---|---|
| `/help` | Muestra la ayuda general de comandos organizada por categoría | `/help` |
| `/history` | Muestra el historial de comandos ejecutados | `/history` |
| `/terminal` | Abre o reconecta una terminal interactiva (bash) en el panel de chat para la sesión actual. La terminal se cataloga por `chatSessionId` en `api_procesos_consola`. Si ya existe una terminal activa para la sesión, reconecta a ella | `/terminal` |
| `/terminal_cerrar` | Cierra la terminal de la sesión actual. Mata el proceso bash y libera recursos | `/terminal_cerrar` |

---

## Navegación

| Comando | Descripción | Uso |
|---|---|---|
| `/cd` | Cambia el directorio de trabajo de la sesión. Sin argumentos muestra un selector interactivo de directorios. Soporta rutas absolutas, relativas, `.`, `..`, `~` y autocompletado con Tab | `/cd [--dir=<ruta>]` |
| `/ls` | Lista el contenido del directorio actual o del especificado | `/ls [--dir=<ruta>]` |
| `/arbol_directorios` | Muestra el árbol de directorios en formato JSON respetando `.gitignore`. Usar `--gitignore=false` para mostrar todo el listado completo. Usar `--filter-extension="sql,md,js"` para mostrar solo directorios que contengan archivos con esas extensiones | `/arbol_directorios [--dir=<ruta>] [--gitignore=<bool>] [--filter-extension=<ext1,ext2>]` |

---

## Utilidades

| Comando | Descripción | Uso |
|---|---|---|
| `/redmine_test_conexion` | Prueba la conexión a la instancia de Redmine configurada | `/redmine_test_conexion` |
| `/redmine_listar_proyectos` | Lista proyectos disponibles en Redmine (solo lectura) | `/redmine_listar_proyectos` |
| `/redmine_importar_proyectos` | Importa proyectos de Redmine a la base de datos local. Usar `--all` para importar todos, `--id` para uno específico por ID de Redmine, o `--slug` para importar por slug | `/redmine_importar_proyectos --all \| --id=<redmine_id> \| --slug=<slug>` |
| `/redmine_listar_tickets` | Obtiene la lista de tickets de Redmine para un proyecto importado. Usa Tab para autocompletar con los proyectos disponibles | `/redmine_listar_tickets --id=<id_proyecto>` |
| `/redmine_importar_tickets` | Importa todos los tickets de Redmine de un proyecto o de todos los proyectos a la base de datos local. Usa Tab para autocompletar | `/redmine_importar_tickets [--id=<id_proyecto> \| --all]` |
| `/redmine_crear_ticket` | Abre un formulario inline para crear un nuevo ticket en Redmine: seleccionar proyecto, asunto, descripción, estado, prioridad, asignado y % de avance | `/redmine_crear_ticket` |
| `/redmine_crear_proyecto` | Crea un nuevo proyecto en la base de datos local y en Redmine. Solicita espacio de trabajo (determina la instancia Redmine), nombre, identificador, descripción y trackers a habilitar (cargados dinámicamente desde Redmine). Los parámetros opcionales pre-rellenan el formulario | `/redmine_crear_proyecto [--nombre=<nombre>] [--descripcion=<texto>] [--workspace=<id>]` |
| `/peticion` | Abre un formulario inline tipo Postman para simular una petición HTTP. Permite elegir método, URL, headers (clave/valor dinámicos) y body. La respuesta se muestra en el chat con código de estado, headers y body. Si el body excede el límite configurado (`request_response_max_size_kb`, default 100KB), se trunca — nunca se rechaza. | `/peticion` |

---

## Navegador (Playwright)

| Comando | Descripción | Uso |
|---|---|---|
| `/navegador_iniciar` | Abre un navegador (chrome/firefox). Usa Tab para autocompletar cada flag. Si el modo sigiloso (stealth) está activado en Settings, se aplica automáticamente. | `/navegador_iniciar [--navegador=chrome\|firefox] [--resolution=ID] [--url=URL]` |
| `/navegador_ir_url` | Navega a una URL en la sesión de navegador activa | `/navegador_ir_url --url=<url>` |
| `/navegador_configurar_headless` | Cambia el modo headless (0 = visible, 1 = headless). Si hay sesión activa, la reinicia | `/navegador_configurar_headless --mode=<0\|1>` |
| `/navegador_finalizar` | Finaliza la sesión de navegador activa | `/navegador_finalizar` |
| `/navegador_extraer_formularios` | Extrae todos los controles de formulario de la página actual del navegador y los devuelve como JSON | `/navegador_extraer_formularios` |
| `/navegador_eventos_iniciar` | Inicia la grabación de eventos de usuario en el navegador activo (clicks, inputs, keydown, scroll, focus, blur, submit, change). Requiere sesión de navegador activa. Los eventos se guardan en la tabla `playwright_events` asociados a la sesión de chat | `/navegador_eventos_iniciar` |
| `/navegador_eventos_detener` | Pausa la grabación de eventos. Los listeners permanecen pero no registran nuevos eventos hasta volver a iniciar | `/navegador_eventos_detener` |
| `/navegador_grabacion_obtener` | Obtiene información de una grabación de eventos por su ID (nombre, proyecto, cantidad de eventos, fecha de creación) | `/navegador_grabacion_obtener --id=<id>` |
| `/navegador_grabacion_listar` | Lista todas las grabaciones de eventos. Opcionalmente filtrar por proyecto. Si no se especifica proyecto, usa el asignado a la sesión de chat actual | `/navegador_grabacion_listar [--project_id=<id>]` |
| `/navegador_grabacion_acciones` | Genera un arreglo JSON de acciones a partir de los eventos de una grabación, ordenado del más antiguo al más reciente. Convierte clicks, inputs, changes, submits, keydowns y scrolls en acciones tipo `click`, `fill`, `select`, `submit`, `press` y `scroll` | `/navegador_grabacion_acciones --id=<id>` |
| `/navegador_grabacion_reproducir` | Reproduce una grabación de eventos en la instancia de navegador activa. Cada acción se ejecuta con un intervalo configurable (por defecto 1000ms). Muestra el progreso paso a paso en el chat | `/navegador_grabacion_reproducir --id=<id> [--intervalo=<ms>]` |
| `/resoluciones_get_all` | Muestra las resoluciones de pantalla configuradas | `/resoluciones_get_all` |
| `/resolucion_get_default` | Muestra la resolución de pantalla por defecto configurada | `/resolucion_get_default` |
| `/resolucion_set_default` | Establece la resolución de pantalla por defecto. Usa Tab para autocompletar el ID de resolución | `/resolucion_set_default --resolucion=<ID>` |
| `/navegador_capturar_pantalla` | Toma una captura de pantalla del navegador activo y la guarda en el proyecto vinculado a la sesión actual. Requiere sesión de navegador activa y proyecto asignado a la sesión de chat | `/navegador_capturar_pantalla [--fullpage=true]` |
| `/capturas_listar` | Lista las capturas de pantalla del proyecto vinculado a la sesión de chat actual, o de un proyecto específico. Muestra cada imagen inline con sus comentarios (`quick_notes`) | `/capturas_listar [--proyecto_id=<id>]` |
| `/navegador_evaluar_selector` | Evalúa un selector CSS en la página activa del navegador y devuelve el valor: valor de input, texto, HTML, atributo, checked, existencia o cantidad. El resultado se muestra en el chat. También disponible desde el panel de grabaciones (botón 🔍 Consultar) | `/navegador_evaluar_selector --selector=<css> [--tipo=<value|text|html|attribute|checked|exists|count>] [--atributo=<nombre>]` |
| `/navegador_simular_evento` | Simula un evento DOM en un elemento de la página activa del navegador. Útil para pruebas automatizadas. El tipo de evento puede ser click, mouseenter, focus, blur, change, etc. | `/navegador_simular_evento --selector=<css> [--tipo=<click|mouseenter|focus|blur|change|...>] [--opciones=<json>]` |

> **Nota:** `replay_interval_ms` no es un comando sino una configuración de workspace (Settings → Intervalo de Reproducción del Navegador). Define el intervalo entre acciones al reproducir una grabación desde el panel Eventos del Navegador. Valor por defecto: 1000ms.

---

## Proyecto

| Comando | Descripción | Uso |
|---|---|---|
| `/chat_set_proyecto` | Asigna un proyecto a la sesión actual. Sin argumentos abre modal para crear uno nuevo | `/chat_set_proyecto [--id=<id_proyecto>]` |
| `/chat_get_proyecto` | Muestra el ID del proyecto asignado a la sesión actual | `/chat_get_proyecto` |
| `/chat_set_repositorio` | Asigna una URL de repositorio GitHub al proyecto actual. Usa Tab para autocompletar `--url=` | `/chat_set_repositorio --url=<url>` |
| `/chat_get_repositorio_url` | Muestra la URL del repositorio configurada para el proyecto actual | `/chat_get_repositorio_url` |
| `/chat_set_ticket` | Asigna un ticket de Redmine a la sesión actual. Autocompletado filtrado por el proyecto de la sesión | `/chat_set_ticket --id=<id_ticket_redmine>` |
| `/chat_get_ticket` | Muestra el ticket de Redmine asignado a la sesión actual, incluyendo su descripción. Con `--comments` muestra también los comentarios. Los adjuntos se listan al final: las imágenes se muestran inline y los archivos se pueden descargar mediante enlace. Con `--field=<campo>` muestra solo el valor de un campo específico (subject, status_name, priority_name, assigned_to_name, description, idTicketRedmine, etc.) | `/chat_get_ticket [--comments] [--field=<campo>]` |
| `/chat_edit_ticket` | Abre un editor inline para modificar los datos del ticket de Redmine asignado a la sesión actual (asunto, descripción, estado, prioridad, asignado, + nuevo comentario). Con `--mode=descripcion` abre un textarea directo con la descripción actual del ticket para editarla, con botón "Mejorar con IA" que abre un modal con agente DeepSeek para mejorar la descripción, y botón "Deshacer" para restaurar el valor original. | `/chat_edit_ticket [--mode=descripcion]` |
| `/chat_ticket_comentar` | Abre un editor inline para agregar un comentario al ticket de Redmine vinculado a la sesión. El texto se pega tal cual (sin formato de commit). Se puede encolar o enviar directamente. | `/chat_ticket_comentar` |
| `/proyecto_var_listar` | Lista las variables definidas para un proyecto. Sin `--id` usa el proyecto de la sesión actual | `/proyecto_var_listar [--id=proyecto]` |
| `/proyecto_var_crear` | Crea una nueva variable en un proyecto. Sin `--id` usa el proyecto de la sesión actual. Usar `--type=memory` para no persistente (db por defecto) | `/proyecto_var_crear --key=nombre --value=valor [--id=proyecto] [--type=db\|memory]` |
| `/proyecto_var_actualizar` | Actualiza el valor de una variable existente en un proyecto. Sin `--id` usa el proyecto de la sesión actual. Usar `--type=memory\|db` para cambiar persistencia | `/proyecto_var_actualizar --key=nombre --value=valor [--id=proyecto] [--type=db\|memory]` |
| `/proyecto_var_eliminar` | Elimina una variable de un proyecto. Sin `--id` usa el proyecto de la sesión actual | `/proyecto_var_eliminar --key=nombre [--id=proyecto]` |
| `/proyecto_color_set` | Establece el color identificativo de un proyecto (formato hexadecimal). Sin `--id` usa el proyecto de la sesión actual | `/proyecto_color_set --color=#ff6b6b [--id=proyecto]` |
| `/archivos_listar` | Lista los archivos del proyecto vinculado a la sesión actual o del especificado | `/archivos_listar [--id=proyecto]` |
| `/archivos_eliminar` | Elimina un archivo del proyecto por su ID | `/archivos_eliminar --id=<id_archivo>` |

### Interpolación de variables

Las variables de proyecto pueden usarse en cualquier campo de texto del chat (mensajes, prompts de OpenCode, etc.) mediante la sintaxis `{{nombre_variable}}`. Al enviar el texto, el sistema resuelve automáticamente las variables reemplazando `{{nombre}}` por su valor, siempre que la sesión tenga un proyecto asignado.

---

## Base de datos

| Comando | Descripción | Uso |
|---|---|---|
| `/db_export` | Exporta la base de datos completa mediante mysqldump a un archivo .sql. Con `--output=<ruta>` se guarda donde se indique; sin él se guarda en `backend/exports/` con timestamp | `/db_export [--output=<ruta>]` |

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
| `/chat_set_workspace` | Asigna un espacio de trabajo (workspace) a la sesión actual. Usa Tab para autocompletar con los workspaces disponibles | `/chat_set_workspace --id=<workspace_id>` |
| `/dev_opencode_iniciar` | Inicia una sesión OpenCode: se habilita la barra inferior (`OpenCodeStickyBar`) con selector de proveedor, modelo, pensamiento, temperatura, modo, switch "Usar descripción del ticket" y textarea para enviar prompts. Los campos se precargan con los últimos valores usados en el proyecto (guardados en `project_variables`). Después de cada respuesta se puede seguir enviando mensajes. | `/dev_opencode_iniciar` |
| `/dev_generar_commit` | Genera un mensaje de commit de los cambios realizados. Obtiene el diff de Git y contexto del ticket, y usa DeepSeek directamente para generar la propuesta. | `/dev_generar_commit` |
| `/dev_opencode_finalizar` | Finaliza la sesión OpenCode activa | `/dev_opencode_finalizar` |
| `/dev_git_crear_rama` | Crea una rama Git a partir del proyecto y ticket de la sesión. Con `--base` se salta la selección de rama base | `/dev_git_crear_rama [--base=<rama_base>]` |
| `/dev_git_ir_rama_ticket` | Cambia a la rama Git asociada al ticket de la sesión actual. Valida que no haya cambios sin comitear, que la sesión tenga ticket asignado y que la rama exista | `/dev_git_ir_rama_ticket` |
| `/dev_redmine_comentarios_listar` | Lista todos los comentarios de Redmine pendientes de envío | `/dev_redmine_comentarios_listar` |
| `/dev_redmine_comentarios_enviar` | Agrupa los comentarios pendientes, muestra vista previa editable y permite enviarlos a Redmine | `/dev_redmine_comentarios_enviar` |
| `/dev_terminal_test_image` | Prueba de renderizado de imagen inline en la terminal vía Sixel/IIP. Genera un PNG de 200x100 directamente en xterm.js | `/dev_terminal_test_image` |

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
| `/despliegue_crear_config` | Escanea el directorio del proyecto, detecta subproyectos con `package.json` y genera automáticamente el archivo `deploy.json` | `/despliegue_crear_config [--dir=<ruta>]` |
| `/despliegue_actualizar_config` | Lee `deploy.json` del directorio del proyecto y guarda la configuración de despliegue. Si no existe `deploy.json`, muestra un formulario interactivo para crearlo | `/despliegue_actualizar_config` |
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
| `/ambientes_diff` | Lista los commits que diferen dos ambientes (ramas), ordenados por fecha ascendente, con enlace a GitHub | `/ambientes_diff --origen=<nombre> --destino=<nombre>` |
| `/ambientes_diff_comentar` | Genera un comentario para el ticket Redmine con las diferencias entre dos ambientes. Con `--tipo=commits` lista los commits. Con `--tipo=testing_notes` usa un agente OpenCode para generar notas de testing basadas en los cambios. Siempre muestra un textarea editable con opción de enviar o encolar | `/ambientes_diff_comentar --origen=<nombre> --destino=<nombre> [--tipo=<commits|testing_notes>]` |

---

## Detección

| Comando | Descripción | Uso |
|---|---|---|
| `/deteccion_funcionalidades` | Obtiene el listado de archivos de código del proyecto filtrado por extensiones configurables, los resume uno por uno vía DeepSeek y entrega el JSON completo con descripciones. Por defecto reutiliza el último escaneo de la sesión (si existe), sobrescribiendo sus archivos. Con `--escaneo-id` reutiliza un escaneo específico. | `/deteccion_funcionalidades [--escaneo-id=<id>]` |

---

---

## Documentación (Notas)

| Comando | Descripción | Uso |
|---------|-------------|-----|
| `/doc_nota_listar` | Lista todas las notas de documentación del proyecto. Si no se especifica proyecto, usa el de la sesión actual | `/doc_nota_listar [--proyecto-id=<id>]` |
| `/doc_nota_crear` | Crea una nota de documentación. Si hay ticket vinculado a la sesión se asocia automáticamente; si no, la nota se crea como documentación general | `/doc_nota_crear --clave=<key> --valor=<text> [--proyecto-id=<id>]` |
| `/doc_nota_ver` | Muestra el contenido completo de una nota de documentación | `/doc_nota_ver --clave=<key> [--proyecto-id=<id>]` |
| `/doc_nota_editar` | Actualiza el contenido de una nota de documentación existente | `/doc_nota_editar --clave=<key> [--valor=<text>] [--proyecto-id=<id>]` |
| `/doc_nota_eliminar` | Elimina una nota de documentación | `/doc_nota_eliminar --clave=<key> [--proyecto-id=<id>]` |

Las notas de documentación se gestionan desde:
- **Panel lateral derecho** → pestaña **Documentación**: lista de claves (izquierda) y editor de texto (derecha), con columnas redimensionables y persistencia de ancho.
- **Chat**: mediante los comandos `/doc_nota_*` listados arriba.

Cada nota se guarda en la tabla `documentacion_notas` y está asociada a un proyecto. Opcionalmente puede asociarse a un ticket de Redmine (si no, es documentación general). El contenido está limitado a 16KB.

---

## Comandos Personalizados

| Comando | Descripción | Uso |
|---------|-------------|-----|
| `/comando_listar` | Lista los comandos personalizados del proyecto de la sesión o del especificado | `/comando_listar [--id=proyecto]` |
| `/comando_crear` | Abre un formulario inline para crear un nuevo comando personalizado (label, descripción, comando shell) | `/comando_crear` |
| `/comando_editar` | Abre un formulario inline precargado para editar un comando existente | `/comando_editar --id=ID` |
| `/comando_eliminar` | Elimina un comando personalizado | `/comando_eliminar --id=ID` |
| `/comando_ejecutar` | Ejecuta un comando personalizado por su ID. Los resultados parciales se muestran en vivo vía SSE | `/comando_ejecutar --id=ID` |

Los comandos personalizados se gestionan desde:
- **Panel lateral derecho** → pestaña **Comandos**: lista, ejecuta, edita y elimina comandos del proyecto asociado a la sesión activa.
- **Chat**: mediante los comandos `/comando_*` listados arriba.

Cada comando se guarda en la tabla `comandos_personalizados_proyectos` y se ejecuta como comando shell (`/bin/sh -c`) en el directorio de trabajo de la sesión.

**Interpolación de variables:** El cuerpo del comando admite la sintaxis `{{nombre_variable}}`. Al ejecutar el comando, el sistema resuelve automáticamente las variables del proyecto (tanto persistentes `type=db` como no persistentes `type=memory`) reemplazando `{{nombre}}` por su valor actual.

---

## Skills

| Comando | Descripción | Uso |
|---------|-------------|-----|
| `/skill_editar` | Crea o edita un skill usando OpenCode. Si no existe, lo crea automáticamente. Toma el cwd de la sesión de chat | `/skill_editar <nombre_skill> <prompt...>` |

Los skills se almacenan en `.agents/skills/<nombre>/SKILL.md` y son instrucciones especializadas que el asistente puede cargar para tareas específicas.

---

## Notas

- Los comandos se definen mediante `register({ name, category, description, usage, execute })` desde `useCommandRegistry.js`
- **Todos los parámetros deben usar el formato `--nombre=valor`** (ver `docs/CRITERIOS_COMANDOS.md`). Excepción: `/git` usa argumentos posicionales por ser un comando _passthrough_ hacia una herramienta externa con sintaxis propia, y `/skill_editar` usa argumentos posicionales porque el prompt es texto libre sin estructura predefinida.
- El archivo `frontend/src/components/layout/Topbar.vue` contiene registros inline
- Cada comando recibe `(args, { cmdStore, chatStore })` en su `execute()`
- Para parsear argumentos usar `parseCommandArgs(args, schema)` desde `frontend/src/composables/parseCommandArgs.js`
