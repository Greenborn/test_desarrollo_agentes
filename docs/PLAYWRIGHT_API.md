# Playwright Service API

Microservicio wrapper de Playwright que permite controlar navegadores (Chrome, Firefox) mediante una API REST. Diseñado para ser usado tanto por humanos como por agentes IA.

---

## 1. Stack

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 21+ (ESM) |
| Framework | Express 4.21+ |
| Automatización | Playwright 1.52+ |
| Entorno | dotenv 16+ |
| Puertos | `backend/.env` → `SERVICIO_PLAYWRIGHT_PORT` |

---

## 2. Configuración

### 2.1 Variables de entorno (en `backend/.env`)

```
SERVICIO_PLAYWRIGHT_PORT=4098
```

### 2.2 Instalación

```bash
cd playwright
npm run setup
# Ejecuta: npm install && npx playwright install chromium firefox
```

### 2.3 Inicio

```bash
npm run dev    # Desarrollo con --watch
npm start      # Producción
```

---

## 3. Endpoints

### 3.1 `POST /api/command`

Endpoint único y genérico que recibe un comando y sus parámetros.

#### Request

```
POST http://localhost:{SERVICIO_PLAYWRIGHT_PORT}/api/command
Content-Type: application/json
```

```json
{
  "comando": "<nombre del comando>",
  "parametros": { <objeto con parámetros> }
}
```

#### Response (éxito)

```json
{
  "success": true
}
```

O para comandos que devuelven datos:

```json
{
  "id_session": "uuid"
}
```

#### Response (error)

```json
{
  "error": "mensaje descriptivo"
}
```

Códigos HTTP:
- `200` — éxito
- `400` — error del cliente (parámetros faltantes, comando desconocido)
- `500` — error interno (fallo al lanzar navegador, navegación fallida)

---

## 4. Comandos

### 4.1 `start`

Inicia una nueva sesión de navegador. Lanza el navegador especificado, crea un contexto y una página, y devuelve un UUID que identifica la sesión.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `navegador` | `string` | Sí | Identificador del navegador: `"chrome"` o `"firefox"` |

#### Ejemplo

```bash
curl -X POST http://localhost:4098/api/command \
  -H 'Content-Type: application/json' \
  -d '{"comando":"start","parametros":{"navegador":"chrome"}}'
```

#### Respuesta

```json
{
  "id_session": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Errores posibles

| Causa | HTTP | Mensaje |
|---|---|---|
| Falta `navegador` | 400 | `Parámetro "navegador" es requerido` |
| Navegador no soportado | 500 | `Navegador no soportado: "edge". Soporta: chrome, firefox` |
| No se pudo iniciar | 500 | `No se pudo iniciar chrome: ...` |

---

### 4.2 `go_to_url`

Navega a una URL dentro de una sesión activa.

#### Parámetros

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_session` | `string` | Sí | UUID de la sesión obtenido de `start` |
| `url` | `string` | Sí | URL completa a navegar (incluye protocolo) |

#### Ejemplo

```bash
curl -X POST http://localhost:4098/api/command \
  -H 'Content-Type: application/json' \
  -d '{"comando":"go_to_url","parametros":{"id_session":"550e8400-e29b-41d4-a716-446655440000","url":"https://example.com"}}'
```

#### Respuesta

```json
{
  "success": true
}
```

#### Errores posibles

| Causa | HTTP | Mensaje |
|---|---|---|
| Falta `id_session` o `url` | 400 | `Parámetros "id_session" y "url" son requeridos` |
| Sesión no existe | 500 | `Sesión no encontrada: "uuid..."` |
| Error de navegación | 500 | `Error al navegar a https://...: ...` |

---

## 5. Flujo típico

```
1. POST /api/command  { "comando": "start",             "parametros": { "navegador": "chrome" } }
   → { "id_session": "abc-123" }

2. POST /api/command  { "comando": "go_to_url",         "parametros": { "id_session": "abc-123", "url": "https://ejemplo.com" } }
   → { "success": true }
```

---

## 6. Gestión de sesiones

- Las sesiones se almacenan en memoria (Map) dentro del proceso.
- Cada sesión contiene: instancia del navegador, contexto y página de Playwright.
- Al reiniciar el servicio, todas las sesiones se pierden.
- No hay límite de sesiones simultáneas (sujeto a recursos del sistema).

### Funciones internas (exportadas por `browserManager.js`)

| Función | Descripción |
|---|---|
| `startSession(navegador)` | Lanza navegador, crea sesión, retorna UUID |
| `goToUrl(idSession, url)` | Navega a URL en la sesión |
| `getSession(idSession)` | Retorna datos de la sesión o `null` |
| `closeSession(idSession)` | Cierra navegador y elimina sesión |

---

## 7. Navegadores soportados

| ID | Tipo Playwright | Comportamiento |
|---|---|---|
| `"chrome"` | `chromium` | Lanza Chromium en modo headless |
| `"firefox"` | `firefox` | Lanza Firefox en modo headless |

Ambos navegadores se lanzan en modo headless (sin interfaz gráfica). Para cambiar este comportamiento, modificar `browserType.launch()` en `browserManager.js`.

---

## 8. Estructura del proyecto

```
playwright/
├── package.json
├── src/
│   ├── index.js                   # Entrypoint Express
│   ├── routes/
│   │   └── command.routes.js      # POST /api/command
│   └── services/
│       └── browserManager.js      # Lógica de Playwright
```

---

## 9. Convenciones del código

- **JavaScript puro** (ESM, no TypeScript)
- Parámetros requeridos validados explícitamente — prohibido `||` como fallback silencioso
- Errores registrados con `console.log` — prohibido `catch {}` vacío
- Sin dependencias externas más allá de express, dotenv y playwright

---

## 10. Referencia rápida para agentes IA

```
COMANDOS DISPONIBLES:
- start      → inicia navegador chrome/firefox, devuelve id_session
- go_to_url  → navega a una URL en una sesión existente

USO:
  { "comando": "start",     "parametros": { "navegador": "chrome"|"firefox" } }
  { "comando": "go_to_url", "parametros": { "id_session": "uuid", "url": "https://..." } }

ERRORES:
  - 400: parámetros faltantes o comando desconocido
  - 500: error interno (navegador no disponible, navegación fallida)
```
