# OpenCode Service — API HTTP de Referencia

Este documento describe la API HTTP que expone el proceso `opencode serve`. No es la API wrapper del backend del proyecto, sino **la API nativa del servicio OpenCode** con la que el backend se comunica directamente.

> **Nota:** OpenCode es una CLI externa. Se spawnza como subproceso con `opencode serve --port <port>` y expone un servidor HTTP en el puerto asignado.

---

## Índice

1. [Resumen de Endpoints](#1-resumen-de-endpoints)
2. [Health Check](#2-health-check)
3. [Configuración / Proveedores](#3-configuración--proveedores)
4. [Sesiones](#4-sesiones)
5. [Prompt Asíncrono](#5-prompt-asíncrono)
6. [Stream de Eventos SSE](#6-stream-de-eventos-sse)
7. [Permisos](#7-permisos)
8. [Abortar Sesión](#8-abortar-sesión)
9. [Diff de Sesión](#9-diff-de-sesión)
10. [Mensajes de Sesión](#10-mensajes-de-sesión)
11. [Formato de Partes (Parts)](#11-formato-de-partes)
12. [Configuración de Modelo](#12-configuración-de-modelo)
13. [Flujo Típico](#13-flujo-típico)

---

## 1. Resumen de Endpoints

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/global/health` | Health check del servidor |
| `GET` | `/config/providers` | Obtener proveedores y modelos disponibles |
| `POST` | `/session` | Crear una nueva sesión de agente |
| `POST` | `/session/{id}/prompt_async` | Enviar un prompt de forma asíncrona |
| `GET` | `/event` | SSE stream de eventos global (todas las sesiones) |
| `POST` | `/session/{id}/permissions/{pid}` | Responder a una solicitud de permiso |
| `POST` | `/session/{id}/abort` | Abortar una sesión activa |
| `GET` | `/session/{id}/diff` | Obtener los cambios (diff) realizados |
| `GET` | `/session/{id}/message` | Obtener los mensajes de la sesión |

**Base URL:** `http://localhost:<port>` donde `<port>` es el puerto asignado al servidor.

**Content-Type general:** `application/json`

---

## 2. Health Check

```
GET /global/health
```

### Respuesta 200

```json
{}
```

Código de estado HTTP `200` indica que el servidor está listo. El cuerpo puede ser un objeto vacío o variar según la versión.

### Uso

Usado por el backend para esperar a que el servidor esté listo (`waitForReady()`):

```javascript
const res = await fetch(`${baseUrl}/global/health`);
if (res.ok) { ready = true; }
```

---

## 3. Configuración / Proveedores

```
GET /config/providers
```

### Respuesta 200

```json
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "models": {
        "claude-sonnet-4-20250514": {
          "name": "Claude Sonnet 4",
          "capabilities": {
            "reasoning": true
          }
        },
        "claude-3-haiku-20240307": {
          "name": "Claude 3 Haiku",
          "capabilities": {
            "reasoning": false
          }
        }
      }
    },
    {
      "id": "openai",
      "name": "OpenAI",
      "models": {
        "gpt-4o": {
          "name": "GPT-4o",
          "capabilities": {
            "reasoning": false
          }
        },
        "o3-mini": {
          "name": "O3 Mini",
          "capabilities": {
            "reasoning": true
          }
        }
      }
    }
  ],
  "default": {
    "anthropic": "claude-sonnet-4-20250514",
    "openai": "gpt-4o"
  }
}
```

### Estructura

| Campo | Tipo | Descripción |
|---|---|---|
| `providers` | array | Lista de proveedores configurados |
| `providers[].id` | string | Identificador único del proveedor |
| `providers[].name` | string | Nombre legible del proveedor |
| `providers[].models` | object | Mapa de modelos, key = ID del modelo |
| `providers[].models[key].name` | string | Nombre legible del modelo |
| `providers[].models[key].capabilities` | object | Capacidades del modelo |
| `providers[].models[key].capabilities.reasoning` | boolean | Si soporta razonamiento (thinking) |
| `default` | object | Mapa de modelo por defecto por proveedor (key = provider id, value = model id) |

---

## 4. Sesiones

```
POST /session
```

Crea una nueva sesión de agente.

### Request

```json
{
  "title": "Agent Orchestrator session",
  "agent": "build"
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `title` | string | No (default interno) | Título descriptivo de la sesión |
| `agent` | string | No | Tipo de agente: `"plan"` o `"build"` |

### Respuesta 201

```json
{
  "id": "uuid-de-la-sesion"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | UUID que identifica la sesión creada |

### Uso

```javascript
const session = await api('/session', {
  method: 'POST',
  body: JSON.stringify({ title: 'mi sesion', agent: 'build' }),
});
// session.id → "abc-123..."
```

---

## 5. Prompt Asíncrono

```
POST /session/{sessionId}/prompt_async
```

Envía un prompt a una sesión existente de forma asíncrona. La respuesta se recibe a través del stream de eventos SSE (`GET /event`).

### Path params

| Parámetro | Descripción |
|---|---|
| `sessionId` | UUID de la sesión obtenido al crearla |

### Request

```json
{
  "parts": [
    { "type": "text", "text": "INSTRUCCIÓN DE IDIOMA: Respondé siempre en español." },
    { "type": "text", "text": "El directorio de trabajo real es \"/ruta/al/proyecto\"" },
    { "type": "text", "text": "Hacé una lista de todos los archivos .js del proyecto." }
  ],
  "model": {
    "providerID": "anthropic",
    "modelID": "claude-sonnet-4-20250514",
    "thinking": { "type": "enabled", "budget_tokens": 4096 },
    "temperature": 0.7,
    "maxTokens": 128000
  }
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `parts` | array | Sí | Array de partes (ver [sección 11](#11-formato-de-partes)) |
| `model` | object | No | Configuración del modelo (ver [sección 12](#12-configuración-de-modelo)) |

### Respuesta 200

Cuerpo vacío o `{}`. La respuesta real llega a través del SSE stream.

### Comportamiento

1. El servidor acepta el prompt inmediatamente (respuesta HTTP 200).
2. El cliente debe estar suscrito a `GET /event` para recibir los eventos en tiempo real.
3. Los eventos incluyen fragmentos de thinking, fragmentos de respuesta, solicitudes de permiso y estado de finalización.
4. El cliente puede distinguir los eventos de esta sesión porque el campo `sessionId` está presente en las propiedades de cada evento.

---

## 6. Stream de Eventos SSE

```
GET /event
```

Conexión SSE (Server-Sent Events) global. Emite eventos de **todas las sesiones activas** del servidor.

### Formato

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"message.part.delta","properties":{...}}

data: {"type":"session.status","properties":{...}}
```

Cada línea `data:` contiene un objeto JSON. Los eventos se separan por doble salto de línea (`\n\n`).

### Eventos

#### 6.1 `message.part.delta`

Fragmento incremental de una parte de mensaje. Es el evento principal para recibir streaming de texto.

```json
{
  "type": "message.part.delta",
  "properties": {
    "sessionId": "uuid-de-la-sesion",
    "messageID": "uuid-del-mensaje",
    "partID": "uuid-de-la-parte",
    "field": "text",
    "delta": "texto incremental (fragmento)"
  }
}
```

| Campo | Descripción |
|---|---|
| `properties.sessionId` | ID de la sesión que genera el evento |
| `properties.messageID` | ID del mensaje en curso |
| `properties.partID` | ID de la parte para correlacionar con `message.part.updated` |
| `properties.field` | Campo que se está actualizando (siempre `"text"`) |
| `properties.delta` | Fragmento de texto incremental |

Los deltas se acumulan según su `partID`. El tipo de parte (razonamiento vs texto) se identifica mediante eventos `message.part.updated` previos.

#### 6.2 `message.part.updated`

Notifica la actualización de una parte (se emite antes de los deltas para identificar el tipo de parte).

```json
{
  "type": "message.part.updated",
  "properties": {
    "sessionId": "uuid-de-la-sesion",
    "messageID": "uuid-del-mensaje",
    "partID": "uuid-de-la-parte",
    "part": {
      "id": "uuid-de-la-parte",
      "type": "text"
    }
  }
}
```

| Campo | Descripción |
|---|---|
| `properties.part.type` | Tipo de parte: `"text"` (respuesta visible) o `"reasoning"` (razonamiento interno) |
| `properties.part.id` | Mismo valor que `partID` |

Este evento permite al cliente clasificar los deltas entrantes: los deltas con `partType = "reasoning"` se muestran como pensamiento, los de `"text"` como respuesta.

#### 6.3 `session.status`

Notifica cambios de estado de la sesión.

```json
{
  "type": "session.status",
  "properties": {
    "sessionId": "uuid-de-la-sesion",
    "status": {
      "type": "idle"
    }
  }
}
```

| Campo | Descripción |
|---|---|
| `properties.status.type` | Tipo de estado. `"idle"` indica que la sesión ha terminado de procesar. |

El cliente debe considerar la sesión como finalizada cuando recibe `status.type = "idle"`.

#### 6.4 Evento de permiso (permissionID)

Cuando el agente necesita autorización del usuario para ejecutar una acción.

```json
{
  "type": "message.created",
  "properties": {
    "sessionId": "uuid-de-la-sesion",
    "permissionID": "uuid-del-permiso",
    "type": "Herramienta: Read",
    "description": "El agente quiere leer el archivo /ruta/archivo.js"
  }
}
```

O alternativamente, el evento puede tener esta estructura:

```json
{
  "properties": {
    "sessionId": "uuid-de-la-sesion",
    "permissionID": "uuid-del-permiso",
    "type": "Herramienta: Bash",
    "description": "El agente quiere ejecutar: ls -la"
  }
}
```

| Campo | Descripción |
|---|---|
| `properties.permissionID` | ID único del permiso, necesario para responder (ver [sección 7](#7-permisos)) |
| `properties.type` | Tipo de herramienta que solicita el permiso |

### Timeout

El backend configura un timeout de 120 segundos entre eventos. Si no se recibe ningún evento en ese lapso, se aborta la conexión.

```javascript
const TIMEOUT_MS = 120000;
```

---

## 7. Permisos

```
POST /session/{sessionId}/permissions/{permissionId}
```

Responde a una solicitud de permiso.

### Path params

| Parámetro | Descripción |
|---|---|
| `sessionId` | UUID de la sesión |
| `permissionId` | UUID del permiso (recibido en el evento SSE) |

### Request

```json
{
  "response": "yes",
  "remember": false
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `response` | string | Sí | `"yes"` para aceptar, `"no"` para rechazar |
| `remember` | boolean | No (default `false`) | Recordar la decisión para futuros permisos similares |

### Respuesta 200

```json
{}
```

---

## 8. Abortar Sesión

```
POST /session/{sessionId}/abort
```

Aborta una sesión activa.

### Path params

| Parámetro | Descripción |
|---|---|
| `sessionId` | UUID de la sesión a abortar |

### Request

Sin cuerpo.

### Respuesta 200

```json
{}
```

---

## 9. Diff de Sesión

```
GET /session/{sessionId}/diff
```

Obtiene los cambios (archivos modificados, creados, etc.) realizados durante la sesión.

### Path params

| Parámetro | Descripción |
|---|---|
| `sessionId` | UUID de la sesión |

### Respuesta 200

```json
[
  {
    "type": "edit",
    "path": "src/index.js",
    "content": "líneas modificadas..."
  },
  {
    "type": "create",
    "path": "src/nuevo-archivo.js",
    "content": "contenido del archivo creado..."
  }
]
```

| Campo | Tipo | Descripción |
|---|---|---|
| `[].type` | string | Tipo de cambio: `"edit"`, `"create"`, `"delete"` |
| `[].path` | string | Ruta del archivo afectado (relativa al cwd) |
| `[].content` | string | Contenido del cambio (diff o contenido completo) |

---

## 10. Mensajes de Sesión

```
GET /session/{sessionId}/message
```

Obtiene todos los mensajes intercambiados en una sesión.

### Path params

| Parámetro | Descripción |
|---|---|
| `sessionId` | UUID de la sesión |

### Respuesta 200

```json
[
  {
    "role": "user",
    "content": [
      { "type": "text", "text": "Analizá el código fuente..." }
    ]
  },
  {
    "role": "assistant",
    "content": "Respuesta completa del asistente...",
    "info": {
      "role": "assistant",
      "tokens": {
        "output": 1500,
        "output_tokens": 1500
      },
      "cost": 0.045
    }
  }
]
```

| Campo | Tipo | Descripción |
|---|---|---|
| `[].role` | string | `"user"` o `"assistant"` |
| `[].content` | string\|array | Contenido del mensaje (texto plano o array de partes) |
| `[].info` | object\|null | Metadatos del mensaje (tokens, costo) — presente solo en mensajes del asistente |
| `[].info.tokens.output` | number | Tokens de salida generados |
| `[].info.tokens.output_tokens` | number | Alternativa: tokens de salida |
| `[].info.cost` | number | Costo estimado del mensaje |

> **Uso:** Este endpoint se usa como fallback cuando la respuesta del stream está vacía, y también para calcular los tokens y costo reales de la respuesta.

---

## 11. Formato de Partes (Parts)

Las partes (`parts`) son el mecanismo para enviar contenido estructurado al agente. Se usan en `POST /session/{id}/prompt_async`.

### Parte de texto

```json
{
  "type": "text",
  "text": "contenido del mensaje"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `type` | string | Siempre `"text"` |
| `text` | string | Contenido de texto de la parte |

### Uso típico

```javascript
const parts = [
  { type: 'text', text: 'Instrucción de idioma: respondé en español.' },
  { type: 'text', text: 'Directorio de trabajo: /ruta/proyecto' },
  { type: 'text', text: 'Usuario: ¿Qué hace esta función?' },
];
```

Se pueden enviar múltiples partes de texto. Se concatenan semánticamente para formar el contexto del prompt.

---

## 12. Configuración de Modelo

Objeto opcional enviado en `POST /session/{id}/prompt_async` dentro del campo `model`.

### Estructura completa

```json
{
  "providerID": "anthropic",
  "modelID": "claude-sonnet-4-20250514",
  "thinking": {
    "type": "enabled",
    "budget_tokens": 4096
  },
  "temperature": 0.7,
  "maxTokens": 128000
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `providerID` | string | ID del proveedor (ej: `"anthropic"`, `"openai"`) |
| `modelID` | string | ID del modelo (ej: `"claude-sonnet-4-20250514"`) |
| `thinking` | object\|string | Configuración de razonamiento. Varía según el proveedor. |
| `temperature` | number | Temperatura (0.0 a 2.0). Controla creatividad vs precisión. |
| `maxTokens` | number | Límite máximo de tokens de salida |

### Thinking por proveedor

**OpenAI:**
```json
{
  "reasoning_effort": "medium"
}
```
Valores: `"low"`, `"medium"`, `"high"`

**Anthropic:**
```json
{
  "thinking": {
    "type": "enabled",
    "budget_tokens": 4096
  }
}
```
Valores de `budget_tokens`: `1024` (low), `4096` (medium), `16384` (high)

---

## 13. Flujo Típico

### Secuencia completa de una interacción

```
Cliente                          Servidor OpenCode
  │                                    │
  │── GET /global/health ──────────────→│
  │←───────── 200 {} ──────────────────│
  │                                    │
  │── GET /config/providers ──────────→│
  │←── 200 { providers: [...], ... } ──│
  │                                    │
  │── POST /session ──────────────────→│
  │←── 201 { id: "ses-123" } ─────────│
  │                                    │
  │── GET /event (SSE) ───────────────→│
  │      (conexión persistente)        │
  │                                    │
  │── POST /session/ses-123/prompt_async ──→│
  │      { parts: [...], model: {...} }     │
  │←───────── 200 {} ──────────────────│
  │                                    │
  │←── SSE: message.part.updated       │
  │     { part: { type: "reasoning" } }│
  │←── SSE: message.part.delta x N     │
  │     { delta: "fragmento..." }      │
  │                                    │
  │←── SSE: message.part.updated       │
  │     { part: { type: "text" } }     │
  │←── SSE: message.part.delta x N     │
  │     { delta: "respuesta..." }      │
  │                                    │
  │  (opcional: solicitud de permiso)  │
  │←── SSE: { permissionID: "perm-1" }│
  │── POST /session/ses-123/permissions/perm-1 ──→│
  │     { response: "yes" }            │
  │                                    │
  │←── SSE: session.status             │
  │     { status: { type: "idle" } }   │
  │  (cierra SSE)                      │
  │                                    │
  │── GET /session/ses-123/diff ───────→│
  │←── 200 [{ type: "edit", ... }] ───│
  │                                    │
  │── GET /session/ses-123/message ───→│
  │←── 200 [{ role: "assistant", ... }]│
  │                                    │
  │── POST /session/ses-123/abort ─────→│
  │      (si se necesita abortar)      │
  │←───────── 200 {} ──────────────────│
```

### Notas importantes

1. **El SSE stream (`GET /event`) debe establecerse ANTES de enviar el prompt.** Caso contrario, se pueden perder eventos iniciales.
2. **Timeout entre eventos:** 120 segundos. Si no hay actividad, el cliente debe abortar y reconectar.
3. **Los permisos detienen el flujo** hasta que el cliente responda. El servidor no continúa hasta recibir `POST /session/{id}/permissions/{pid}`.
4. **No hay autenticación** en la API del servicio OpenCode. Es responsabilidad del backend (o del orquestador) controlar el acceso.
5. **Cada servidor es efímero.** Al matar el proceso `opencode serve`, todas las sesiones y datos se pierden.
