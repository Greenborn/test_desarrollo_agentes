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
        "workspace_id": 1,
        "prefs": null
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

Iguales a `GET /api/chat/sessions`:

| Campo               | Tipo    | Descripción                                        |
|---------------------|---------|----------------------------------------------------|
| `id`                | number  | Identificador de la sesión                         |
| `title`             | string  | Título de la sesión                                |
| `updated_at`        | string  | Última actualización (ISO 8601)                    |
| `cwd`               | string  | Directorio de trabajo                              |
| `proyecto_id`       | number/null | Proyecto vinculado                          |
| `id_ticket_redmine` | number/null | Ticket Redmine vinculado                  |
| `workspace_id`      | number  | Workspace al que pertenece                         |
| `prefs`             | object/null | Preferencias de la sesión                      |

## Consideraciones

- Todas las sesiones se devuelven **sin filtrar por usuario ni workspace** (no hay sesión HTTP en el
  WebSocket).
- Si no se provee callback ack, la respuesta se registra solo en consola (no se envía).
- Consulta en paralelo de activas (`archived = false`) y archivadas (`archived = true`), ambas
  ordenadas por `updated_at` descendente.

## Referencias en el código

- Implementación del pseudoendpoint: `backend/src/modules/interfaz_remota/interfaz_remota.service.js`
  (función `handleChatSessionsRequest` + registro `socket.on('interfaz-remota:chatSessions', ...)`).
- Endpoints HTTP equivalentes: `backend/src/routes/chat.routes.js` (`/sessions` y `/sessions/archived`).
