# API OpenCode — Documentación de Referencia

Este documento describe la integración con **OpenCode CLI** (herramienta externa de orquestación de agentes de IA) en el sistema. OpenCode se ejecuta como un subproceso (`child_process.spawn`) en el servidor backend y se comunica vía HTTP REST + SSE streaming.

---

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Configuración](#2-configuración)
3. [Endpoints HTTP del Backend](#3-endpoints-http-del-backend)
    - [GET /api/opencode/start](#31-get-apiopencodestart)
    - [POST /api/opencode/select](#32-post-apiopencodeselect)
    - [POST /api/opencode/send](#33-post-apiopencodesend)
    - [POST /api/opencode/control](#34-post-apiopencodecontrol)
    - [POST /api/opencode/abort](#35-post-apiopencodeabort)
    - [POST /api/opencode/finish](#36-post-apiopencodefinish)
4. [Eventos SSE (Server-Sent Events)](#4-eventos-sse)
5. [API Interna del Servicio OpenCode (opencode serve)](#5-api-interna-del-servicio-opencode)
6. [Frontend — Pinia Store (useOpencodeStore)](#6-frontend--pinia-store)
7. [Frontend — Composable (useOpencodeStreaming)](#7-frontend--composable-useopencodestreaming)
8. [Modelo de Datos en Base de Datos](#8-modelo-de-datos)
9. [Roles de Mensaje en Chat](#9-roles-de-mensaje-en-chat)
10. [Flujo Completo de una Interacción](#10-flujo-completo)
11. [Arquitectura de Sesiones Multi-Chat](#11-arquitectura-de-sesiones-multi-chat)

---

## 1. Arquitectura General

```
Frontend (Vue 3)                  Backend (Express)                  OpenCode CLI
     │                                 │                                 │
     │── POST /api/opencode/send ──────→│                                 │
     │                                 │── spawn('opencode', ['serve']) →│
     │                                 │         (subproceso)            │
     │                                 │── POST /session ───────────────→│
     │                                 │── POST /session/{id}/prompt_async →│
     │←── SSE stream (thinking/response/control_request/done) ────────────│
     │                                 │←── GET /event (SSE stream) ─────│
     │── POST /api/opencode/control ──→│                                 │
     │                                 │── POST /session/{id}/permissions/{pid} →│
```

**Componentes involucrados:**
- **Frontend:** `frontend/src/stores/opencode.js` (store Pinia), `frontend/src/composables/useOpencodeStreaming.js`
- **Backend:** `backend/src/routes/opencode.routes.js` (rutas Express), `backend/src/services/opencode.js` (gestor del proceso OpenCode)
- **CLI externa:** `opencode serve` — se spawnza como subproceso en un puerto asignado dinámicamente

---

## 2. Configuración

| Variable | Default | Descripción |
|---|---|---|
| `OPENCODE_PORT` | `4150` | Puerto base para servidores OpenCode. Cada sesión de chat recibe un puerto incremental (+1). |

**Archivo:** `backend/.env`
```
OPENCODE_PORT=4150
```

El puerto base se valida al arrancar el backend (`opencode.js:4-10`). Si no está definido o no es válido, lanza error.

---

## 3. Endpoints HTTP del Backend

Todas las rutas están montadas bajo `/api/opencode` y requieren sesión activa (cookie `session_token`).

### 3.1 GET /api/opencode/start

Inicializa (o recupera) un servidor OpenCode y devuelve los proveedores/modelos disponibles.

**Query params:**
| Parámetro | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `sessionId` | number | No | ID de la sesión de chat. Determina el `cwd` (directorio de trabajo) y asigna el servidor. |

**Respuesta 200:**
```json
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "models": {
        "claude-sonnet-4-20250514": {
          "name": "Claude Sonnet 4",
          "capabilities": { "reasoning": true }
        }
      }
    }
  ],
  "defaultModels": { "anthropic": "claude-sonnet-4-20250514" },
  "savedProvider": "anthropic",
  "savedModel": "claude-sonnet-4-20250514",
  "savedThinking": "medium",
  "savedMode": "Build",
  "savedTemperature": "0.7"
}
```

**Comportamiento:**
- Si `sessionId` está presente, busca el `cwd` en `chat_sessions` y lo usa como directorio de trabajo.
- Usa `workspaceIds[0]` de la sesión (o `1` por defecto) para obtener el locale desde `settings`.
- Los campos `saved*` se leen primero de `user_settings` para la key `opencode_last_*`.
- Si `sessionId` tiene un proyecto asociado (`chat_sessions.proyecto_id`), los valores guardados en `project_variables` (keys `opencode_*`) sobreescriben los de `user_settings`.
- El frontend aplica estos `saved*` como valores por defecto de los `selected*` en el store.
- El servidor OpenCode se inicia (si no existe) y se consulta `GET /config/providers`.

**Código fuente:** `backend/src/routes/opencode.routes.js:60-110`

---

### 3.2 POST /api/opencode/select

Guarda una preferencia del usuario sobre la configuración de OpenCode.

**Body:**
```json
{
  "key": "provider",
  "value": "anthropic",
  "sessionId": 123
}
```

**Respuesta 200:** `{ "success": true }`

**Comportamiento:**
- Guarda en `user_settings` la key `opencode_last_<key>` para el usuario autenticado.
- Si `sessionId` está presente y tiene un proyecto asociado (`chat_sessions.proyecto_id`), también guarda en `project_variables` la key `opencode_<key>` con type `'db'` (upsert).
- Keys válidas: `provider`, `model`, `thinking`, `mode`, `temperature`.

**Código fuente:** `backend/src/routes/opencode.routes.js:112-135`

---

### 3.3 POST /api/opencode/send

Envía un prompt a OpenCode y recibe la respuesta como SSE stream.

**Body:**
```json
{
  "prompt": "string (requerido)",
  "provider": "string (opcional)",
  "model": "string (opcional)",
  "thinking": "string (opcional) — 'low' | 'medium' | 'high'",
  "mode": "string (opcional) — 'Plan' | 'Build'",
  "temperature": "string|number (opcional)",
  "sessionId": "number (opcional)",
  "ocSessionId": "string (opcional, para continuar sesión existente)"
}
```

**Respuesta:** SSE stream (`Content-Type: text/event-stream`)

**Eventos emitidos:**
| Evento | Descripción |
|---|---|
| `{"type":"thinking","content":"..."}` | Fragmento del razonamiento del modelo |
| `{"type":"response","content":"..."}` | Fragmento de la respuesta textual |
| `{"type":"control_request","control":{...}}` | Solicitud de permiso al usuario |
| `{"type":"done","ocSessionId","hash","fullResponse","thinking","diff":[...]}` | Finalización exitosa |
| `{"type":"error","content":"..."}` | Error durante el procesamiento |

**Comportamiento detallado:**

1. **Inicio del servidor:** Si no existe un servidor OpenCode para `sessionId`, inicia uno con `opencode serve --port <nextPort>` en el directorio `cwd` de la sesión.
2. **Creación de sesión:** Si no se proporciona `ocSessionId`, crea una nueva sesión OpenCode con `createSession(title, agentName)` donde `agentName` es `'plan'` o `'build'` según el modo.
3. **Construcción de instrucciones:** Se inyectan 3 instrucciones del sistema antes del prompt del usuario:
   - `INSTRUCCIÓN DE IDIOMA`: Forzar español según locale.
   - `INSTRUCCIÓN`: El directorio de trabajo real.
   - `INSTRUCCIÓN CRÍTICA`: Siempre responder con texto después de cada herramienta.
4. **Streaming:** Se conecta a `GET /event` del servidor OpenCode, envía el prompt con `sendPromptAsync` y reenvía los eventos al frontend.
5. **Control (permisos):** Cuando OpenCode solicita permisos (herramientas como leer archivos, ejecutar comandos), se emite un evento `control_request` al frontend y se espera hasta 5 minutos (300s) por la respuesta del usuario vía `/api/opencode/control`.
6. **Finalización:** Al recibir `session.status: idle`, se obtiene el diff (`getSessionDiff`), se guarda en `chat_messages` con rol `opencode_result` y `opencode_info`, se registran los gastos en `api_gastos` (si hay proyecto asociado), y se envía el evento `done`.
7. **Mensajes largos:** Si la respuesta supera 50.000 caracteres, se parte en múltiples mensajes con `[Parte N/M]`.
8. **Fallback de respuesta:** Si `fullResponse` está vacío al terminar, intenta recuperar la respuesta desde `getSessionMessages`.

**Configuración de modelo:**
```javascript
// Mapeo de thinking según provider:
if (provider === 'openai') {
  modelConfig.reasoning_effort = thinking;  // 'low', 'medium', 'high'
} else if (provider === 'anthropic') {
  modelConfig.thinking = {
    type: 'enabled',
    budget_tokens: thinking === 'low' ? 1024 : thinking === 'medium' ? 4096 : 16384
  };
}

// Temperatura (si se envía):
modelConfig.temperature = parseFloat(temperature);

// Límite de tokens:
modelConfig.maxTokens = 128000;
```

**Registro de gastos:** Si la sesión tiene un `proyecto_id` asociado, se registra el consumo de tokens y costo en `api_gastos` (`POST /api/gastos/register`). Los tokens y costo se obtienen del último mensaje `assistant` en la sesión OpenCode, o se estiman como `Math.ceil(fullResponse.length / 4)` como fallback.

**Código fuente:** `backend/src/routes/opencode.routes.js:109-363`

---

### 3.4 POST /api/opencode/control

Responde a una solicitud de permiso (control_request) de OpenCode.

**Body:**
```json
{
  "controlId": "string (requerido)",
  "response": "yes|no",
  "remember": false
}
```

**Respuesta 200:** `{ "success": true }`

**Comportamiento:**
- Usa un `EventEmitter` global (`controlEmitter`) para enviar la respuesta al flujo SSE pendiente.
- Timeout de 5 minutos en el flujo SSE; si vence, se responde `{ response: 'yes', remember: false }` automáticamente.

**Código fuente:** `backend/src/routes/opencode.routes.js:365-376`

---

### 3.5 POST /api/opencode/abort

Aborta una sesión OpenCode activa.

**Body:**
```json
{
  "ocSessionId": "string (opcional si está sessionId)",
  "sessionId": "number (opcional)"
}
```

**Respuesta 200:** `{ "success": true }`

**Comportamiento:**
- Si se proporciona `sessionId`, busca el servidor asociado y aborta la sesión con `abortSessionInDir`.
- Si solo `ocSessionId`, busca en todos los servidores activos con `abortSession`.

**Código fuente:** `backend/src/routes/opencode.routes.js:378-396`

---

### 3.6 POST /api/opencode/finish

Finaliza una sesión de chat OpenCode: aborta la sesión activa y detiene el servidor.

**Body:**
```json
{
  "sessionId": "number (requerido)",
  "ocSessionId": "string (opcional)"
}
```

**Respuesta 200:** `{ "success": true, "hash": "string|null" }`

**Comportamiento:**
1. Si `ocSessionId` existe, aborta la sesión con `abortSessionInDir`.
2. Llama a `stopServer(sessionId)` que mata el proceso `opencode serve` y elimina la referencia.

**Código fuente:** `backend/src/routes/opencode.routes.js:398-415`

---

## 4. Eventos SSE

Formato general de eventos SSE emitidos por `POST /api/opencode/send`:

```
data: {"type":"thinking","content":"..."}
data: {"type":"response","content":"..."}
data: {"type":"control_request","control":{...}}
data: {"type":"done","ocSessionId":"...","hash":"...","fullResponse":"...","thinking":"...","diff":[...]}
data: {"type":"error","content":"..."}
```

### 4.1 Evento `thinking`

Fragmento de razonamiento del modelo (visible al usuario para depuración).

```json
{
  "type": "thinking",
  "content": "string — fragmento de texto de razonamiento",
  "sessionId": "number|null"
}
```

### 4.2 Evento `response`

Fragmento de la respuesta textual del asistente.

```json
{
  "type": "response",
  "content": "string — fragmento de texto de respuesta",
  "sessionId": "number|null"
}
```

### 4.3 Evento `control_request`

Solicitud de permiso. OpenCode necesita autorización del usuario para ejecutar una acción (ej: leer archivo, ejecutar comando).

```json
{
  "type": "control_request",
  "control": {
    "controlId": "string — ID único para correlacionar la respuesta",
    "controlType": "buttons|select",
    "type": "permission",
    "permissionID": "string — ID del permiso en OpenCode",
    "question": "string — descripción de lo que se solicita",
    "options": [
      { "label": "Aceptar", "value": "yes" },
      { "label": "Rechazar", "value": "no" }
    ]
  }
}
```

El frontend debe mostrar estos controles al usuario y enviar la respuesta vía `POST /api/opencode/control`.

### 4.4 Evento `done`

Finalización exitosa. Se emite una sola vez al final del stream.

```json
{
  "type": "done",
  "ocSessionId": "string — ID de la sesión OpenCode",
  "hash": "string — mismo que ocSessionId",
  "fullResponse": "string — texto completo de la respuesta",
  "thinking": "string — texto completo del razonamiento (puede ser null)",
  "diff": [
    {
      "type": "string — tipo de cambio",
      "path": "string — ruta del archivo modificado",
      "content": "string — contenido del cambio"
    }
  ]
}
```

### 4.5 Evento `error`

Error durante el procesamiento.

```json
{
  "type": "error",
  "content": "string — mensaje de error"
}
```

---

## 5. API Interna del Servicio OpenCode

El servicio `backend/src/services/opencode.js` expone la clase `OpenCodeServer` que encapsula la comunicación HTTP con el proceso `opencode serve`.

### 5.1 Clase OpenCodeServer

#### Constructor

```javascript
new OpenCodeServer(directory, port, locale)
```

- `directory`: String — directorio de trabajo donde se spawnza el proceso.
- `port`: Number — puerto donde escuchará el servidor.
- `locale`: String — locale para las variables de entorno LANG/LC_ALL (default `'es_ES.UTF-8'`).

#### Métodos

| Método | Descripción |
|---|---|
| `start()` | Spawnea `opencode serve --port <port>` como subproceso. Resuelve cuando el servidor reporta `listening` o `Server` en stdout/stderr. Timeout 15s. |
| `waitForReady()` | Health check polling (`GET /global/health`) cada 300ms hasta 15s. |
| `stop()` | Mata el proceso (`process.kill()`). |
| `baseUrl()` | Devuelve `http://localhost:<port>`. |
| `api(path, options)` | Llamada HTTP genérica a la API de OpenCode. Lanza error si response no es ok. |
| `createSession(title, agent)` | `POST /session` — Crea una nueva sesión. `agent` puede ser `'plan'` o `'build'`. |
| `sendPromptAsync(sessionId, parts, options)` | `POST /session/{id}/prompt_async` — Envía un prompt asíncrono. `parts` es array de objetos `{ type, text }`. `options` puede contener `model`. |
| `streamSession(sessionId, parts, options)` | Async generator que se conecta a `GET /event` (SSE), envía el prompt y yield cada evento parseado. Timeout 120s entre eventos. |
| `respondToPermission(sessionId, permissionId, response, remember)` | `POST /session/{id}/permissions/{pid}` — Responde a un permiso. |
| `abortSession(sessionId)` | `POST /session/{id}/abort` — Aborta una sesión. |
| `getSessionDiff(sessionId)` | `GET /session/{id}/diff` — Obtiene los cambios realizados. |
| `getSessionMessages(sessionId)` | `GET /session/{id}/message` — Obtiene los mensajes de la sesión. |

### 5.2 Funciones exportadas del módulo

| Función | Descripción |
|---|---|
| `getOrStartServer(directory, chatSessionId, locale)` | Obtiene un servidor existente o crea uno nuevo. Los servidores se indexan por `chatSessionId`. |
| `stopServer(chatSessionId)` | Detiene y elimina el servidor asociado a una sesión de chat. |
| `stopServerByDirectory(directory)` | Detiene todos los servidores en un directorio específico. |
| `stopAllServers()` | Detiene todos los servidores. Usado en shutdown del backend. |
| `getModels(directory, chatSessionId, locale)` | Obtiene proveedores/modelos disponibles vía `GET /config/providers`. |
| `abortSessionInDir(chatSessionId, ocSessionId)` | Aborta una sesión en el servidor de una sesión de chat específica. |
| `abortSession(ocSessionId)` | Busca en todos los servidores activos y aborta la sesión. |

### 5.3 Gestión del ciclo de vida

Los servidores OpenCode se almacenan en un objeto global `servers` indexado por `chatSessionId`:

```javascript
servers = {
  "123": { server: OpenCodeServer, directory: "/path/to/project" },
  "456": { server: OpenCodeServer, directory: "/path/to/other" },
}
```

Cada servidor ocupa un puerto incremental desde `OPENCODE_PORT`. Se detienen automáticamente al:
- Llamar a `POST /api/opencode/finish`
- Cambiar/deseleccionar workspaces (desde `api/workspaces/stop-all`)
- Shutdown del backend (SIGTERM, SIGINT, cierre ordenado)

---

## 6. Frontend — Pinia Store

**Archivo:** `frontend/src/stores/opencode.js`

### 6.1 Estado

| Propiedad | Tipo | Default | Descripción |
|---|---|---|---|
| `step` | string | `'idle'` | Estado del flujo: `idle`, etc. |
| `ocSessionId` | string\|null | `null` | ID de la sesión OpenCode activa |
| `chatSessionId` | number\|null | `null` | ID de la sesión de chat vinculada |
| `defaultModels` | object | `{}` | Modelos por defecto por proveedor |
| `providers` | array | `[]` | Proveedores disponibles desde OpenCode |
| `savedProvider` | string | `''` | Último proveedor usado (desde user_settings) |
| `savedModel` | string | `''` | Último modelo usado |
| `savedThinking` | string | `''` | Último nivel de thinking |
| `savedMode` | string | `''` | Último modo (Plan/Build) |
| `savedTemperature` | string | `''` | Última temperatura |
| `selectedProvider` | string | `''` | Proveedor seleccionado actualmente |
| `selectedModel` | string | `''` | Modelo seleccionado actualmente |
| `selectedThinking` | string | `''` | Thinking seleccionado actualmente |
| `selectedMode` | string | `''` | Modo seleccionado actualmente |
| `selectedTemperature` | string | `''` | Temperatura seleccionada actualmente |
| `streaming` | boolean | `false` | Si hay un stream en curso |
| `streamText` | string | `''` | Texto del stream en sesión activa |
| `streamThinking` | string | `''` | Thinking del stream en sesión activa |
| `messageQueue` | array | `[]` | Cola de mensajes pendientes |
| `processing` | boolean | `false` | Si hay mensajes en cola siendo procesados |
| `sessionsMap` | object | `{}` | Mapa de estado por sesión de chat |

### 6.2 Opciones fijas

```javascript
const thinkingOptions = [
  { label: 'Low — mínimo esfuerzo de razonamiento', value: 'low' },
  { label: 'Medium — equilibrio entre velocidad y profundidad', value: 'medium' },
  { label: 'High — máximo razonamiento profundo', value: 'high' },
]

const temperatureOptions = [
  { label: 'Precisa (0.0)', value: '0' },
  { label: 'Balanceada (0.7)', value: '0.7' },
  { label: 'Creativa (1.5)', value: '1.5' },
]
```

### 6.3 Métodos

| Método | Descripción |
|---|---|
| `start(chatSessionId?)` | `GET /api/opencode/start`. Inicializa el store con proveedores y preferencias guardadas. Además, aplica los `saved*` a los `selected*` si están vacíos (para sesiones nuevas). |
| `select(key, value)` | `POST /api/opencode/select`. Guarda preferencia en backend. Si `chatSessionId` está disponible, lo envía como `sessionId` para persistir también en `project_variables`. |
| `streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, callbacks)` | Envía un prompt a OpenCode con callbacks: `onChunk`, `onThinking`, `onControl`, `onDone`, `onError`. |
| `finish()` | Limpia el estado local (no llama al backend). |
| `clearAllSessions()` | Limpia todas las sesiones del store. |
| `activateSession(chatSid)` | Cambia a otra sesión guardada en `sessionsMap`. |
| `saveCurrentToMap(chatSid, extraFields?)` | Guarda estado actual en el mapa de sesiones. Acepta `extraFields` opcional (ej: `{ ocInput }`). |
| `setSessionOcInput(chatSid, text)` | Guarda el texto del StickyBar (`ocInput`) para una sesión en el mapa. |
| `getSessionOcInput(chatSid)` | Recupera el texto del StickyBar guardado para una sesión. |
| `saveUiState()` | Persiste el estado actual en `sessionStorage`. |
| `restoreFromSession()` | Restaura estado desde `sessionStorage`. |
| `restoreFromState(savedState)` | Restaura estado desde un objeto. |
| `getAvailableProviders()` | Devuelve array `[{ label, value }]` para selects. |
| `getModelsForProvider(providerId)` | Devuelve array `[{ label, value, reasoning }]` para selects. |
| `modelSupportsReasoning(providerId, modelKey)` | Boolean — si el modelo soporta razonamiento. |
| `getActiveSessionsCount()` | Número de sesiones con `ocSessionId`. |

### 6.4 Persistencia

El store persiste su estado en `sessionStorage` bajo la clave `oc_opencode_state`. Se guarda:
- `activeChatSession`: ID de la sesión activa de chat
- `sessions`: Mapa completo de `sessionsMap` (por sesión de chat)

Esto permite recuperar el estado al recargar la página.

---

## 7. Frontend — Composable useOpencodeStreaming

**Archivo:** `frontend/src/composables/useOpencodeStreaming.js`

Composable que orquesta el streaming de OpenCode para diferentes casos de uso. Usa internamente `useOpencodeStore().streamPrompt()`.

### 7.1 Funciones expuestas

| Función | Descripción |
|---|---|
| `opencodeStreamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature)` | Prompt genérico. Crea un mensaje `opencode_stream` en el chat, actualiza en vivo el contenido y al finalizar lo convierte a `opencode_result`. |
| `opencodeStreamPromptCommit(sessionId, prompt, provider, model, thinking, mode, temperature)` | Prompt para generar commits. Al finalizar, envía la respuesta a `/api/chat/refine` para reducir el mensaje a ≤256 caracteres. Muestra el resultado como `commit_result` (control). |
| `opencodeStreamPromptTestingNotes(sessionId, prompt, provider, model, thinking, mode, temperature, origen, destino)` | Prompt para generar notas de testing. Muestra el resultado como `ambientes_diff_comment` (control). |
| `opencodeStreamPromptDocUpdate(sessionId, prompt, provider, model, thinking, mode, temperature, proyectoId, tipo)` | Prompt para actualizar documentación. Al finalizar, guarda la respuesta en la documentación del proyecto vía `PUT /api/documentacion/:tipo/:proyectoId`. |
| `opencodeStreamDescripcion(sessionId, prompt, provider, model, thinking, mode, temperature, ticket)` | Prompt para generar/mejorar descripciones de tickets. Muestra el resultado como `descripcion_result` (control). |
| `opencodeStreamDescripcionFollowup(sessionId, userPrompt, ticket, temperature, descripcionData)` | Continuación de una generación de descripción. Envía un mensaje de seguimiento al mismo modelo/configuración. |

### 7.2 Callbacks (internos, pasados a streamPrompt)

| Callback | Activación |
|---|---|
| `onChunk(content)` | Cada fragmento de respuesta |
| `onThinking(content)` | Cada fragmento de razonamiento |
| `onControl(control)` | Solicitud de permiso |
| `onDone(json, fullText)` | Finalización exitosa |
| `onError(msg)` | Error |

### 7.3 Variables reactivas

| Variable | Descripción |
|---|---|
| `ocStreaming` | Boolean — si hay un stream activo |
| `ocChunk` | String — fragmento de respuesta en sesión activa |
| `ocThinking` | String — fragmento de thinking en sesión activa |
| `streamSessionId` | ID de la sesión que está transmitiendo |
| `streamingConsole` | Boolean — true si modo Build (para mostrar consola) |

### 7.4 Resolución de variables

El composable incluye `resolveInput(text)` que reemplaza `{{variables}}` en el texto del prompt con valores reales del proyecto obtenidos del endpoint `/api/proyecto/:id/variables`.

---

## 8. Modelo de Datos

### 8.1 Tablas afectadas

| Tabla | Columnas relacionadas |
|---|---|
| `chat_messages` | `role` ('opencode_result', 'opencode_control', 'opencode_info', 'opencode_stream'), `thinking` (texto largo de razonamiento) |
| `chat_sessions` | `cwd` (directorio de trabajo usado por OpenCode) |
| `user_settings` | Keys: `opencode_last_provider`, `opencode_last_model`, `opencode_last_thinking`, `opencode_last_mode`, `opencode_last_temperature` |
| `settings` | `locale` (idioma para OpenCode, ej: `es_ES.UTF-8`) |
| `gastos` | `id_sesion_opencode` (migración 016) |

### 8.2 Migraciones

| Migración | Cambio |
|---|---|
| `009_alter_chat_messages_role_add_opencode.js` | Añade rol `opencode_result` |
| `016_add_id_sesion_opencode_to_gastos.js` | Añade columna `id_sesion_opencode` a `gastos` |
| `025_alter_chat_messages_role_add_opencode_control.js` | Añade rol `opencode_control` |
| `045_alter_chat_messages_role_add_opencode_confirmed.js` | Añade rol `opencode_confirmed` |

---

## 9. Roles de Mensaje en Chat

Los mensajes relacionados con OpenCode usan roles especiales en `chat_messages`:

| Rol | Propósito | Contenido |
|---|---|---|
| `opencode_result` | Respuesta completa del asistente OpenCode | Texto de la respuesta. Columna `thinking` guarda el razonamiento. |
| `opencode_control` | Solicitud de permiso al usuario | JSON del control (controlId, permissionID, pregunta, opciones). |
| `opencode_info` | Información técnica de la sesión | JSON con `type`, `hash` (ocSessionId), `diff`, `error`. |
| `opencode_stream` | Mensaje temporal durante el streaming | Se actualiza en vivo; al finalizar se convierte a `opencode_result`. |
| `opencode_confirmed` | Mensaje confirmado | Contenido final confirmado por el usuario. |

**Nota:** Los roles no estándar (`opencode_*`) se normalizan a `user`/`system` antes de enviar a DeepSeek (ver `normalizeMessages()` en `services/deepseek.js`).

---

## 10. Flujo Completo de una Interacción

### Inicio

1. Usuario ejecuta `/dev_opencode_iniciar` o hace clic en "Iniciar OpenCode" en la barra de ticket.
2. El comando llama a `opencodeStore.start(sessionId)` → `GET /api/opencode/start?sessionId=X`.
3. El backend inicia (o reusa) un servidor `opencode serve` en el `cwd` de la sesión.
4. El backend consulta `GET /config/providers` y devuelve los proveedores disponibles.
5. El backend lee `user_settings` + `project_variables` y devuelve las preferencias guardadas.
6. El frontend aplica `saved*` a `selected*` y vincula el `chatSessionId`.
7. Aparece `OpenCodeStickyBar` en la parte inferior con los campos precargados.
8. Si no hay proveedor guardado, se muestra el selector de proveedor dentro del StickyBar.

### Envío de prompt

1. Usuario escribe un mensaje en el `OpenCodeStickyBar` (textarea de 5 filas con auto-resize).
2. Opcional: activa el switch "Usar descripción del ticket" para precargar la descripción.
3. El frontend llama a `useOpencodeStreaming().opencodeStreamPrompt()` (o variante).
4. Se crea un mensaje temporal `opencode_stream` en el chat.
5. Se llama a `opencodeStore.streamPrompt()` → `POST /api/opencode/send`.
5. El backend:
   - Obtiene/crea el servidor OpenCode.
   - Crea una sesión OpenCode (`POST /session`) con agente `plan` o `build`.
   - Inicia el SSE stream (conectándose a `GET /event` del servidor).
   - Envía el prompt asíncrono (`POST /session/{id}/prompt_async`).
   - Stream: Los eventos se reenvían al frontend como SSE.

### Durante el streaming

1. El frontend recibe eventos `thinking` y actualiza el bloque de razonamiento.
2. El frontend recibe eventos `response` y actualiza el mensaje `opencode_stream` en vivo.
3. Si OpenCode solicita un permiso:
   - El backend emite evento `control_request` y espera.
   - El frontend muestra botones "Aceptar"/"Rechazar" en el chat.
   - El usuario responde → `POST /api/opencode/control`.
   - El backend envía la respuesta a OpenCode (`POST /session/{id}/permissions/{pid}`).
   - El stream continúa.

### Finalización

1. OpenCode reporta `idle` → el backend obtiene el diff y calcula tokens.
2. Se guardan los mensajes finales en `chat_messages` (roles `opencode_result` y `opencode_info`).
3. Se registran los gastos en `api_gastos`.
4. El backend envía evento `done` con la respuesta completa.
5. El frontend:
   - Reemplaza el mensaje `opencode_stream` por `opencode_result`.
   - Muestra el resultado final.
   - Para commits: envía a `/api/chat/refine` para acortar el mensaje.
   - Para documentación: guarda en el proyecto con `PUT /api/documentacion/:tipo/:proyectoId`.
6. El usuario puede finalizar explícitamente con `POST /api/opencode/finish`, que detiene el servidor.

---

## 11. Arquitectura de Sesiones Multi-Chat

El sistema soporta múltiples sesiones de chat OpenCode simultáneas. Cada sesión de chat tiene:

- **Su propio servidor OpenCode** (un proceso `opencode serve` en un puerto único).
- **Su propio estado** guardado en `sessionsMap` del store Pinia.
- **Su propio stream** de datos en `_ocStreamData`.

### Cambio entre sesiones

```javascript
// Al activar otra sesión de chat:
opencodeStore.activateSession(newChatSessionId)
// Guarda estado de la sesión actual en sessionsMap
// Carga estado de la nueva sesión desde sessionsMap
// Actualiza streaming, streamText, streamThinking si hay datos activos
```

### Persistencia en sessionStorage

```javascript
sessionStorage.setItem('oc_opencode_state', JSON.stringify({
  activeChatSession: currentActiveChatSession,
  sessions: sessionsMap,
}))
```

### Componentes UI

| Componente | Archivo | Propósito |
|---|---|---|
| `OpenCodeStickyBar` | `frontend/src/components/chat/OpenCodeStickyBar.vue` | Barra inferior con selector de proveedor (si no hay), modelo/pensamiento/temperatura/modo, switch "Usar descripción del ticket" y textarea (5 filas, auto-resize). Incluye autocompletado de variables `{{...}}`. Se activa al ejecutar `/dev_opencode_iniciar`. |
| `OpenCodeStreamDisplay` | `frontend/src/components/chat/OpenCodeStreamDisplay.vue` | Visualización del streaming en vivo (thinking colapsable + respuesta). |
| `ChatOpencodeForm` | `frontend/src/components/chat-controls/ChatOpencodeForm.vue` | Formulario completo con selector de modelo, thinking, temperatura, modo y opción de usar descripción del ticket. Usado en comandos `/dev_opencode_generar_commit` y otros flujos que requieren wizard paso a paso. |
| `VariableAutocomplete` | `frontend/src/components/chat/VariableAutocomplete.vue` | Autocompletado de variables `{{...}}` usando datos reales del proyecto. |
