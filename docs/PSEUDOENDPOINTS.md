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

## Consideraciones

- Todas las sesiones se devuelven **sin filtrar por usuario ni workspace** (no hay sesión HTTP en el
  WebSocket).
- Si no se provee callback ack, la respuesta se registra solo en consola (no se envía).
- Consulta en paralelo de activas (`archived = false`) y archivadas (`archived = true`), ambas
  ordenadas por `updated_at` descendente.

## Rol de la gestión interna (SGI) como retransmisor

Este pseudoendpoint no lo emite el sistema de desarrollo de forma autónoma: lo dispara la **gestión
interna** (SGI). El flujo completo es:

1. El frontend admin del SGI emite `desarrollo:getChatSessions` con `{ sistemaId }` hacia el backend
   del SGI (`sgi-backend/src/desarrollo.js`).
2. El SGI localiza el socket del sistema dev anunciado y **retransmite** emitiendo
   `interfaz-remota:chatSessions` con un payload vacío `{}` + callback ack hacia ese socket.
3. El sistema dev responde por ese mismo ACK con `{ success, data: { activas, archivadas } }`.
4. El SGI reenvía la respuesta tal cual por el ACK del solicitante.

**Reintentos serializados (lado SGI):** el SGI reintenta (2 × 3500ms) pero nunca re-emite
`interfaz-remota:chatSessions` mientras ya haya una emisión en vuelo contra el mismo socket
(`emisionActiva`), para no disparar consultas DB duplicadas que bloqueen el event loop del sistema
dev (provocaría `ping timeout` → reconexión espuria). El SGI sube además su `pingTimeout` a 60s.

## Referencias en el código

- Implementación del pseudoendpoint: `backend/src/modules/interfaz_remota/interfaz_remota.service.js`
  (función `handleChatSessionsRequest` + registro `socket.on('interfaz-remota:chatSessions', ...)`).
- Endpoints HTTP equivalentes: `backend/src/routes/chat.routes.js` (`/sessions` y `/sessions/archived`).
