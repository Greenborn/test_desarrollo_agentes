# Pseudoendpoints de Interfaz Remota

Un **pseudoendpoint** es un contrato request/response sobre el WebSocket (socket.io) del módulo
`interfaz_remota`. No es un endpoint HTTP: la **gestión interna** emite un evento sobre el socket
con un **callback ack** y el backend del sistema de desarrollo consulta sus datos y responde por
ese mismo ack.

## Transporte y autenticación

- Conexión: `socket.io-client` con `transports: ['websocket']`, path `/socket.io`.
- El backend del sistema de desarrollo se conecta como **cliente** a la gestión interna
  (`socket.io-client`), por lo que la gestión interna actúa como **servidor socket.io**.
- Autenticación del socket: token SSO/local enviado en `auth.token` (obtenido con `POST /api/auth/login`
  del servicio de gestión interna).
- El sistema se anuncia con `desarrollo:announce` (heartbeat ~45s). El panel admin de la gestión
  interna (`/#/admin/desarrollo`) muestra los sistemas conectados.

## Evento `interfaz-remota:chatSessions`

Consulta las **sesiones de chat actuales** del sistema de desarrollo, tanto activas como archivadas.

### Request

```js
socket.emit('interfaz-remota:chatSessions', (resp) => {
  console.log(resp);
});
```

El payload de petición es opcional (ignorado por el backend actualmente). Se pasa únicamente el
callback ack.

### Response (ack)

Éxito:

```json
{
  "success": true,
  "data": {
    "activas": [
      {
        "id": 1,
        "title": "Sesión de ejemplo",
        "updated_at": "2026-08-14T10:00:00.000Z",
        "cwd": "/ruta/de/trabajo",
        "proyecto_id": null,
        "id_ticket_redmine": null,
        "workspace_id": 1
      }
    ],
    "archivadas": []
  }
}
```

Error:

```json
{ "success": false, "error": "<mensaje de error>" }
```

### Campos por sesión

| Campo               | Tipo    | Descripción                                        |
|---------------------|---------|----------------------------------------------------|
| `id`                | number  | Identificador de la sesión                         |
| `title`             | string  | Título de la sesión                                |
| `updated_at`        | string  | Última actualización (ISO 8601)                    |
| `cwd`               | string  | Directorio de trabajo                              |
| `proyecto_id`       | number/null | Proyecto vinculado                          |
| `id_ticket_redmine` | number/null | Ticket Redmine vinculado                  |
| `workspace_id`      | number  | Workspace al que pertenece                         |

> **Nota:** el campo `prefs` de `chat_sessions` se **excluye** a propósito del payload. Puede contener
> cientos de KB por sesión y, con muchas sesiones, infla el ACK por encima del límite por defecto de
> socket.io (~1 MB), lo que corta la conexión en el `transport close` y el SGI recibe
> "El sistema de desarrollo no respondió". El listado de sesiones no necesita `prefs`.

## Evento `interfaz-remota:getMessages`

Lee el **historial de mensajes** de una sesión de chat.

### Request

```js
socket.emit('interfaz-remota:getMessages', { sessionId: 1, limit: 200 }, (resp) => {
  console.log(resp);
});
```

- `sessionId` (requerido): id de la sesión.
- `limit` (opcional, default 200, máx 500): número máximo de mensajes a devolver.

### Response (ack)

```json
{
  "success": true,
  "data": {
    "sessionId": 1,
    "messages": [
      {
        "id": 10,
        "role": "user",
        "content": "Hola",
        "thinking": null,
        "created_at": "2026-08-14T10:00:00.000Z"
      },
      {
        "id": 11,
        "role": "assistant",
        "content": "¡Hola!",
        "thinking": "Pensamiento interno",
        "created_at": "2026-08-14T10:00:05.000Z"
      }
    ]
  }
}
```

Los roles pueden ser `user`, `assistant`, `command`, `result`, `opencode_info`, `opencode_result`,
`opencode_control`, `opencode_confirmed`. Los mensajes se devuelven en orden ascendente (`created_at`).

## Evento `interfaz-remota:sendMessage`

Envía un **mensaje de chat** a una sesión y devuelve la **respuesta final del agente** (DeepSeek).
Guarda los mensajes `user` y `assistant` en `chat_messages` y actualiza `chat_sessions.updated_at`.

### Request

```js
socket.emit('interfaz-remota:sendMessage', { sessionId: 1, message: 'Resume el proyecto' }, (resp) => {
  console.log(resp);
});
```

- `sessionId` (requerido): id de la sesión.
- `message` (requerido): texto del mensaje del usuario.

### Response (ack)

```json
{
  "success": true,
  "data": {
    "content": "El proyecto consiste en...",
    "thinking": "Pensamiento interno"
  }
}
```

El `ack` se responde **una sola vez con la respuesta completa** (no se transmite streaming sobre el
socket). `thinking` puede ser `null`. La sesión recibe el historial completo y se usa el modelo
configurado (DeepSeek u Ollama) igual que el chat normal. No se registra gastos de tokens en este
pseudoendpoint.

## Evento `interfaz-remota:sendCommand`

Ejecuta un **comando de backend** sobre una sesión. Comandos soportados: `/cd`, `/ls`, `/help`,
`/history` y `/dev_opencode_iniciar` (inicia el servidor OpenCode de la sesión y crea una instancia
nueva). Un comando desconocido devuelve `Error: comando desconocido`. No hay fallback al agente.
Persiste los mensajes `command` y `result` en `chat_messages`.

### Request

```js
socket.emit('interfaz-remota:sendCommand', { sessionId: 1, command: '/ls' }, (resp) => {
  console.log(resp);
});
```

- `sessionId` (requerido): id de la sesión.
- `command` (requerido): texto del comando (empieza por `/`). Soportados: `/cd`, `/ls`, `/help`,
  `/history`, `/dev_opencode_iniciar`.

### Response (ack)

```json
{
  "success": true,
  "data": {
    "success": true,
    "result": "d  node_modules\n-  package.json\n"
  }
}
```

- `data.success`: `true` si el comando no devolvió un error.
- `data.result`: salida del comando o `Error: ...` si falló.

#### Nota sobre `/dev_opencode_iniciar`

Inicia el servidor OpenCode del sistema dev para la sesión (si no estaba corriendo) y crea una
instancia nueva. Requiere que la sesión tenga `cwd` definido (ajústalo antes con `/cd <ruta>`); si no
tiene `cwd`, devuelve `Error`. Ejemplo de resultado exitoso:

```
✅ OpenCode iniciado en: /ruta/de/trabajo
Instancia OpenCode: <oc-session-id>
```

## Evento `interfaz-remota:crearSesion`

Crea una **nueva sesión de chat** en el sistema de desarrollo.

### Request

```js
socket.emit('interfaz-remota:crearSesion', { title: 'Nueva tarea', cwd: '/ruta' }, (resp) => {
  console.log(resp);
});
```

- `title` (opcional): título. Si no se provee, se genera `DD/MM HH:mm`.
- `cwd` (opcional): directorio de trabajo.

### Response (ack)

```json
{
  "success": true,
  "data": {
    "session": {
      "id": 5,
      "title": "Nueva tarea",
      "cwd": "/ruta",
      "workspace_id": 1,
      "archived": 0
    }
  }
}
```

## Evento `interfaz-remota:listComandos`

Lista los **comandos personalizados** del proyecto al que pertenece una sesión de chat (tabla
`comandos_personalizados_proyectos`). Si la sesión no tiene `proyecto_id`, devuelve lista vacía.

### Request

```js
socket.emit('interfaz-remota:listComandos', { sessionId: 1 }, (resp) => {
  console.log(resp);
});
```

- `sessionId` (requerido): id de la sesión.

### Response (ack)

```json
{
  "success": true,
  "data": {
    "sessionId": 1,
    "comandos": [
      {
        "id": 3,
        "label": "Compilar frontend",
        "descripcion": "Ejecuta el build de producción",
        "comando": "npm run build --prefix {{FRONTEND_DIR}}",
        "id_proyecto": 7,
        "ocultar_ejecucion": 0
      }
    ]
  }
}
```

`comandos` contiene las filas completas de `comandos_personalizados_proyectos` (no se incluye la
resolución de variables; eso lo hace `ejecutarComando`).

## Evento `interfaz-remota:ejecutarComando`

Ejecuta un **comando personalizado** sobre una sesión. Resuelve las variables `{{key}}` del proyecto
y usa el `cwd` de la sesión, captura la salida completa y persiste los mensajes `command` y `result`
en `chat_messages`. El transporte por ACK no soporta streaming: la salida se devuelve completa al
terminar.

### Request

```js
socket.emit('interfaz-remota:ejecutarComando', { sessionId: 1, comandoId: 3 }, (resp) => {
  console.log(resp);
});
```

- `sessionId` (requerido): id de la sesión.
- `comandoId` (requerido): id del comando personalizado (de `listComandos`).

### Response (ack)

```json
{
  "success": true,
  "data": {
    "result": "✓ built in 2.07s\n",
    "success": true,
    "ocultarEjecucion": false
  }
}
```

- `data.success`: `true` si el proceso salió con código 0.
- `data.result`: salida combinada (stdout + stderr) o `(sin salida)`.
- `data.ocultarEjecucion`: `true` si el comando está marcado para no mostrar el comando ejecutado.

## Terminal remota simulada

Replica la usabilidad de `/terminal` del frontend local desde la gestión interna. El sistema dev crea
un **PTY real** (`node-pty`, shell bash) por sesión y transmite su I/O por socket.io. El **ciclo de
vida** usa pseudoendpoints con ack; el **streaming** (salida y fin del proceso) usa eventos socket.io
**sin ack**.

### Ciclo de vida (pseudoendpoints con ack)

Todos devuelven `{ success, data }` o `{ success: false, error }`.

#### `interfaz-remota:terminal:create`
- **Request:** `{ sessionId, cwd?, cmd? }`
- **Respuesta:** `{ success, data: { terminalId } }`
- Crea el PTY (bash) para la sesión, con `cwd` y `cmd` opcionales (si `cmd` se omite arranca un shell
  interactivo). A partir de aquí el sistema dev emite los eventos de streaming con ese `terminalId`.

#### `interfaz-remota:terminal:input`
- **Request:** `{ sessionId, terminalId, data }`
- **Respuesta:** `{ success }`
- Escribe `data` en el PTY (p. ej. `"ls\r"` o `"echo hola\r"`).

#### `interfaz-remota:terminal:resize`
- **Request:** `{ sessionId, terminalId, cols, rows }` (enteros positivos)
- **Respuesta:** `{ success }`
- Redimensiona el PTY.

#### `interfaz-remota:terminal:close`
- **Request:** `{ sessionId, terminalId }`
- **Respuesta:** `{ success }`
- Mata el proceso del PTY y elimina la terminal.

#### `interfaz-remota:terminal:list`
- **Request:** `{ sessionId }`
- **Respuesta:** `{ success, data: { terminals: [{ terminalId, chatSessionId, cwd, cmd, pid, createdAt }] } }`
- Lista las terminales activas de la sesión.

### Streaming (eventos sin ack, sistema dev → gestión interna)

- **`interfaz-remota:terminal:data`** — payload `{ chatSessionId, terminalId, data }` con la salida
  del PTY (puede contener códigos ANSI; el frontend los limpia).
- **`interfaz-remota:terminal:exit`** — payload `{ chatSessionId, terminalId, code, signal, output }`
  cuando el proceso termina.

### Notas

- El sistema dev gestiona las terminales en memoria (`remoteTerminal.js`). Al desconectar el socket
  SGI o detener la interfaz remota, **todas** las terminales se cierran.
- Las operaciones se serializan con la misma cola que el resto de pseudoendpoints para no bloquear el
  event loop del sistema dev.
- El frontend SGI filtra los eventos por `terminalId` + `chatSessionId`.

## Consideraciones

- Todas las sesiones se devuelven **sin filtrar por usuario ni workspace** (no hay sesión HTTP en el
  WebSocket).
- Si no se provee callback ack, la respuesta se registra solo en consola (no se envía).
- Consulta en paralelo de activas (`archived = false`) y archivadas (`archived = true`), ambas
  ordenadas por `updated_at` descendente.
- Los pseudoendpoints que leen/escriben DB o transmiten con el agente se **serializan** mediante una
  cola de promesas en el sistema dev para no bloquear su event loop (evita `ping timeout` → reconexión).

## Rol de la gestión interna (SGI) como retransmisor

Estos pseudoendpoints no los emite el sistema de desarrollo de forma autónoma: los dispara la **gestión
interna** (SGI). El flujo completo es:

1. El frontend admin del SGI emite `desarrollo:<accion>` con `{ sistemaId, ... }` hacia el backend
   del SGI (`sgi-backend/src/desarrollo.js`).
2. El SGI localiza el socket del sistema dev anunciado y **retransmite** emitiendo
   `interfaz-remota:<accion>` con el mismo payload + callback ack hacia ese socket.
3. El sistema dev responde por ese mismo ACK con `{ success, data }`.
4. El SGI reenvía la respuesta tal cual por el ACK del solicitante.

Correspondencia evento SGI → evento dev:

| SGI frontend → SGI backend | SGI backend → sistema dev |
|----------------------------|---------------------------|
| `desarrollo:getChatSessions` | `interfaz-remota:chatSessions` |
| `desarrollo:getMessages` | `interfaz-remota:getMessages` |
| `desarrollo:sendMessage` | `interfaz-remota:sendMessage` |
| `desarrollo:sendCommand` | `interfaz-remota:sendCommand` |
| `desarrollo:sendControl` | `interfaz-remota:sendControl` |
| `desarrollo:listComandos` | `interfaz-remota:listComandos` |
| `desarrollo:ejecutarComando` | `interfaz-remota:ejecutarComando` |
| `desarrollo:crearSesion` | `interfaz-remota:crearSesion` |
| `desarrollo:terminal:create` | `interfaz-remota:terminal:create` |
| `desarrollo:terminal:input` | `interfaz-remota:terminal:input` |
| `desarrollo:terminal:resize` | `interfaz-remota:terminal:resize` |
| `desarrollo:terminal:close` | `interfaz-remota:terminal:close` |
| `desarrollo:terminal:list` | `interfaz-remota:terminal:list` |

Streaming (sistema dev → SGI → clientes admin):

| Sistema dev → SGI backend | SGI backend → clientes (broadcast) |
|---------------------------|------------------------------------|
| `interfaz-remota:terminal:data` | `desarrollo:terminal:data` |
| `interfaz-remota:terminal:exit` | `desarrollo:terminal:exit` |

**Reintentos serializados (lado SGI):** el SGI reintenta (2 × 3500ms) pero nunca re-emite un
pseudoendpoint mientras ya haya una emisión en vuelo contra el mismo socket (`emisionActiva`), para no
disparar operaciones DB/streaming duplicadas que bloqueen el event loop del sistema dev (provocaría
`ping timeout` → reconexión espuria). El SGI sube además su `pingTimeout` a 60s.

## Referencias en el código

- Implementación de los pseudoendpoints: `backend/src/modules/interfaz_remota/interfaz_remota.service.js`
  (funciones `queryChatSessions`, `getChatMessages`, `sendChatMessage`, `executeChatCommand`,
  `listComandosPersonalizados`, `ejecutarComandoPersonalizadoRemoto`, `createChatSession` +
  registros `socket.on('interfaz-remota:*', ...)`).
- Comandos personalizados: `backend/src/services/comandosPersonalizados.service.js` (listar, resolver
  variables, ejecutar) — usado por `backend/src/routes/comandosPersonalizados.routes.js` y por los
  pseudoendpoints `listComandos`/`ejecutarComando`.
- Terminal remota simulada: `backend/src/modules/interfaz_remota/remoteTerminal.js`.
- Ejecución de comandos de backend: `backend/src/services/commandExecutor.js` (`executeBackendCommand`),
  también usado por `backend/src/routes/command.routes.js` (`POST /execute`).
- Relay en SGI: `sistema-gestion-interno/sgi-backend/src/desarrollo.js` (función `crearRetransmisor`).
- UI del SGI: `sistema-gestion-interno/sgi-frontend/src/components/ChatSessionsModal.vue`.
- Endpoints HTTP de test equivalentes: `backend/src/modules/interfaz_remota/interfaz_remota.routes.js`
  (`POST /api/interfaz-remota/test/*`).
- Endpoints HTTP equivalentes: `backend/src/routes/chat.routes.js` (`/sessions` y `/sessions/archived`,
  `/sessions/:id/messages`).
